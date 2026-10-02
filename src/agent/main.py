import os
import sys
import requests
import json
import re
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import psutil
import win32com.client
from dotenv import load_dotenv

# Pastikan output console mendukung UTF-8 (emoji dari respons LLM)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Load environment variables
load_dotenv()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")

# Persistent memory file path
MEMORY_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "conversation_memory.json")

# 1. Load knowledge base pribadi dari file-file di data/personal
def load_personal_knowledge():
    documents = []
    personal_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "personal")
    
    if not os.path.exists(personal_dir):
        return None
    
    for filename in os.listdir(personal_dir):
        file_path = os.path.join(personal_dir, filename)
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if content.strip():
                    documents.append({"content": content, "source": filename})
        except Exception as e:
            print(f"Error reading {filename}: {e}")
    
    if not documents:
        return None
    
    # Split menjadi chunks
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=20)
    all_texts = []
    for doc in documents:
        chunks = text_splitter.split_text(doc["content"])
        for i, chunk in enumerate(chunks):
            all_texts.append({"content": chunk, "source": f"{doc['source']}_chunk_{i}"})
    
    if not all_texts:
        return None
    
    # Buat embeddings
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Ekstrak content dan metadatas
    texts = [t["content"] for t in all_texts]
    metadatas = [{"source": t["source"]} for t in all_texts]
    
    # Buat vector store FAISS - coba load yang sudah ada dulu
    vectorstore = load_existing_faiss(texts, embeddings, metadatas)
    if vectorstore is None:
        # Jika belum ada, buat yang baru
        vectorstore = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
        save_faiss_index(vectorstore)
    
    return vectorstore


# Fungsi baru: Load FAISS index yang sudah ada dari disk
def load_existing_faiss(texts, embeddings, metadatas):
    """Coba load FAISS index yang sudah ada, jika tidak ada kembalikan None."""
    faiss_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "knowledge-base", "faiss_index")
    
    if os.path.exists(faiss_path):
        try:
            # Load yang sudah ada (file index dibuat sendiri, aman untuk di-load)
            vectorstore = FAISS.load_local(faiss_path, embeddings, allow_dangerous_deserialization=True)
            # Tambahkan texts baru hanya jika belum ada di index
            if texts:
                existing_docs = list(vectorstore.docstore._dict.values())
                existing_texts = [doc.page_content for doc in existing_docs]
                new_texts = []
                new_metadatas = []
                for text, meta in zip(texts, metadatas):
                    if text not in existing_texts:
                        new_texts.append(text)
                        new_metadatas.append(meta)
                if new_texts:
                    combined_texts = existing_texts + new_texts
                    combined_metadatas = [doc.metadata for doc in existing_docs] + new_metadatas
                    vectorstore = FAISS.from_texts(combined_texts, embeddings, metadatas=combined_metadatas)
                    save_faiss_index(vectorstore)
            return vectorstore
        except Exception as e:
            print(f"Gagal load FAISS lama: {e}")
    
    return None


# Fungsi baru: Save FAISS index ke disk
def save_faiss_index(vectorstore):
    """Simpan FAISS index ke disk untuk persistence."""
    faiss_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "knowledge-base", "faiss_index")
    try:
        vectorstore.save_local(faiss_path)
    except Exception as e:
        print(f"Gagal save FAISS: {e}")


# 2. Fungsi mendapatkan response dari Ollama
def get_ollama_response(prompt, timeout=120):
    """Get response from Ollama model directly via HTTP."""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "think": False,  # Nonaktifkan mode thinking agar respons lebih cepat
                "options": {"num_predict": 512}
            },
            timeout=timeout
        )
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "")
        else:
            return f"Error: Ollama returned status {response.status_code}"
    except requests.exceptions.Timeout:
        return "Error: Ollama timeout - model terlalu lama merespon. Coba lagi atau tunggu sebentar."
    except Exception as e:
        return f"Error connecting to Ollama: {str(e)}"


# 3. Fungsi mencari konteks relevan dari knowledge base
def retrieve_relevant_context(vectorstore, query, k=3):
    """Mencari dokumen relevan dari vector store berdasarkan query."""
    if vectorstore is None:
        return ""
    try:
        docs = vectorstore.similarity_search(query, k=k)
        contexts = [doc.page_content for doc in docs]
        return "\n\n".join(contexts)
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return ""


# Fungsi baru: Deteksi informasi baru yang layak disimpan dari percakapan
def detect_new_memory(user_input, existing_memories):
    """Deteksi dan ekstrak informasi penting baru dari input pengguna."""
    new_memories = []
    
    # Pertanyaan bukan pernyataan - jangan simpan sebagai memori
    if user_input.strip().endswith("?"):
        return new_memories
    
    # Kata-kata yang bukan informasi valid
    junk_words = {"apa", "siapa", "kapan", "dimana", "di mana", "mengapa", "kenapa",
                  "bagaimana", "gimana", "berapa", "yang", "itu", "ini", "saja",
                  "kah", "tidak", "bukan", "ya", "saya", "aku", "dia", "mereka"}
    
    # Pattern-pattern yang mengindikasikan informasi penting
    patterns = [
        r"(namaku|nama saya|saya bernama)\s+(.+?)(?:\.|,|$)",
        r"(saya suka|hobi saya|minat saya)\s+(.+?)(?:\.|,|$)",
        r"(saya bekerja di|perusahaan saya|pekerjaan saya)\s+(.+?)(?:\.|,|$)",
        r"(alamat saya|telepon saya|kontak)\s+(.+?)(?:\.|,|$)",
        r"(target|tujuan|ingin)\s+(.+?)(?:\.|,|$)",
        r"(cita-cita|impian|masa depan)\s+(.+?)(?:\.|,|$)",
        r"(fobia|ketakutan|alergi)\s+(.+?)(?:\.|,|$)",
        r"(nomor favorit|warna favorit|makan favorit)\s+(.+?)(?:\.|,|$)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, user_input, re.IGNORECASE)
        if match:
            key_info = match.group(2).strip().rstrip("?").strip()
            # Tolak jika kosong, terlalu pendek, atau hanya kata tanya/junk
            if not key_info or len(key_info) <= 2 or key_info.lower() in junk_words:
                continue
            # Cek apakah sudah ada di memori yang ada
            sudah_ada = False
            for mem in existing_memories:
                if key_info.lower() in mem.lower() or mem.lower() in key_info.lower():
                    sudah_ada = True
                    break
            
            if not sudah_ada:
                new_memories.append(key_info)
    
    return new_memories


# Fungsi baru: Load memori dari file JSON
def load_conversation_memories():
    """Memuat memori percakapan dari file JSON yang sudah disimpan."""
    if os.path.exists(MEMORY_FILE):
        try:
            # utf-8-sig agar tahan terhadap file dengan BOM
            with open(MEMORY_FILE, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception as e:
            print(f"Gagal load memory file: {e}")
    return []


# Fungsi baru: Save memori ke file JSON
def save_conversation_memories(memories):
    """Menyimpan memori percakapan ke file JSON untuk persistence."""
    try:
        os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(memories, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Gagal save memory file: {e}")


# Fungsi: Gabungkan memori dengan knowledge base
def merge_memories_with_knowledge(vectorstore, memories):
    """Menambahkan memori ke dalam knowledge base FAISS."""
    if not memories or vectorstore is None:
        return vectorstore
    
    try:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Buat dokument dari memori
        memory_texts = []
        memory_metadatas = []
        for i, memory in enumerate(memories):
            memory_texts.append(memory)
            memory_metadatas.append({"source": f"memory_{i}", "type": "conversation_memory"})
        
        # Ambil dokumen yang sudah ada dari FAISS
        current_docs = vectorstore.similarity_search("", k=1000)
        existing_texts = [doc.page_content for doc in current_docs]
        existing_metadatas = [doc.metadata for doc in current_docs]
        
        # Hanya tambahkan memori yang belum ada di index
        new_texts = []
        new_metadatas = []
        for text, meta in zip(memory_texts, memory_metadatas):
            if text not in existing_texts:
                new_texts.append(text)
                new_metadatas.append(meta)
        
        if not new_texts:
            return vectorstore
        
        # Gabungkan dan update
        all_texts = existing_texts + new_texts
        all_metadatas = existing_metadatas + new_metadatas
        
        # Create new vectorstore with all texts
        vectorstore = FAISS.from_texts(all_texts, embeddings, metadatas=all_metadatas)
        save_faiss_index(vectorstore)
        
    except Exception as e:
        print(f"Error merging memories: {e}")
    
    return vectorstore


# 4. Generate response dari LLM dengan context
def generate_response(llm_type, context, query, vectorstore, memories):
    """Generate response menggunakan Ollama dengan memberikan context dan query."""
    if llm_type == "ollama":
        # Ambil konteks dari knowledge base
        context_kb = retrieve_relevant_context(vectorstore, query, k=3)
        
        # Ambil konteks dari memori percakapan
        context_memory = ""
        if memories:
            # Sertakan memori yang relevan, atau semua jika jumlah sedikit
            query_words = set(query.lower().split())
            relevant = [m for m in memories if query_words & set(m.lower().split())]
            memory_texts = relevant if relevant else memories[:5]
            context_memory = "\n\nMemori percakapan sebelumnya:\n" + "\n".join(memory_texts)
        
        # Gabungkan semua context
        full_context = context_kb + context_memory
        
        if not full_context.strip():
            return get_ollama_response(query)
        
        prompt = f"Berikut adalah informasi yang relevan dari knowledge base pribadi:\n\n{full_context}\n\nBerikut adalah pertanyaan: {query}\n\nJawaban berdasarkan informasi di atas:"
        return get_ollama_response(prompt)
    else:
        return get_ollama_response(query)


# 5. Fungsi berinteraksi dengan device (Windows-specific)
def interact_with_device(command):
    """Memproses perintah berinteraksi dengan device Windows."""
    try:
        if command.startswith("buka "):
            app_name = command.replace("buka ", "").strip()
            os.system(f"start {app_name}")
            return f"Membuka aplikasi: {app_name}"
        
        elif command == "status battery":
            try:
                battery = psutil.sensors_battery()
                percent = battery.percent
                power_plugged = battery.plugged
                status = "Sedang mengunci" if power_plugged else "Menggunakan baterai"
                return f"Baterai: {percent}% - {status}"
            except Exception:
                return "Tidak dapat membaca status baterai (perangkat tidak mendukung atau tidak terdeteksi)"
        
        elif command == "status sistem":
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            return (f"Sistem: CPU {cpu_percent}% | Memory {memory.percent}% | "
                    f"Disk {disk.percent}% digunakan ({disk.free // (1024**3)} GB free)")
        
        elif command == "tutup semua":
            os.system("taskkill /f /im notepad.exe 2>nul")
            os.system("taskkill /f /im calculator.exe 2>nul")
            return "Mencoba menutup aplikasi standar"
        
        elif command == "lokasi saat ini":
            import subprocess
            try:
                result = subprocess.run(["powershell", "-Command", "Write-Output $env:USERPROFILE"], 
                                      capture_output=True, text=True)
                return f"Home directory: {result.stdout.strip()}"
            except Exception:
                return "Tidak dapat mendapatkan lokasi"
        
        else:
            return "Perintah device tidak dikenali. Perintah tersedia: buka <nama>, status battery, status sistem, tutup semua, lokasi saat ini"
    
    except ImportError:
        return "Modul kontrol device tidak tersedia"
    except Exception as e:
        return f"Error interacting with device: {str(e)}"


# 6. Main loop
def main():
    print("=" * 60)
    print("=== ASISTEN AI PRIBADI DENGAN OLLAMA DAN MEMORY PERSISTEN ===")
    print("=" * 60)
    print("Sistem dimulai... Memuat knowledge base dan memori pribadi...")
    print()
    
    # Inisialisasi knowledge base
    vectorstore = load_personal_knowledge()
    
    if vectorstore is None:
        print("Warning: Knowledge base empty. Agent will operate only based on Ollama.")
    
    # Load memori percakapan yang sudah disimpan
    memories = load_conversation_memories()
    
    # Gabungkan memori dengan knowledge base
    vectorstore = merge_memories_with_knowledge(vectorstore, memories)
    
    print("Memori percakapan lama dimuat: " + str(len(memories)) + " entri")
    print("Ollama model '" + OLLAMA_MODEL + "' siap.")
    
    # Warm-up: Muat model sekali agar respons pertama lebih cepat
    print("Memuat model Ollama (tunggu sebentar)...")
    warmup = get_ollama_response("Hi", timeout=60)
    if "Error" not in warmup:
        print("Model siap digunakan!\n")
    else:
        print("Warning: Model belum siap, respons mungkin lambat.\n")
    
    print("Perintah yang tersedia:")
    print("  - Tanya apapun (agent akan mencari di knowledge base pribadi)")
    print("  - 'device status battery' - Cek baterai")
    print("  - 'device status sistem' - Cek CPU/Memory/Disk")
    print("  - 'device buka <nama>' - Buka aplikasi")
    print("  - 'device tutup semua' - Tutup aplikasi standar")
    print("  - 'exit' / 'quit' / 'keluar' - Keluar program")
    print("-" * 60)
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            
            if user_input.lower() in ["exit", "quit", "keluar", "exit()"]:
                # Simpan memori baru sebelum keluar
                save_conversation_memories(memories)
                print("\nSampai jumpa! Agent menutup... Memori disimpan.")
                break
            
            # Cek perintah berinteraksi dengan device
            lower_input = user_input.lower()
            device_triggers = ["device ", "buka ", "status ", "tutup ", "lokasi"]
            
            handled = False
            for trigger in device_triggers:
                if lower_input.startswith(trigger):
                    # Strip prefix "device " jika ada
                    device_cmd = lower_input[7:] if lower_input.startswith("device ") else lower_input
                    response = interact_with_device(device_cmd)
                    print(f"Agent: {response}")
                    handled = True
                    break
            
            if handled:
                # Setelah perintah device, cek apakah ada info baru untuk disimpan
                detected = detect_new_memory(user_input, memories)
                if detected:
                    memories.extend(detected)
                    # Simpan memori yang sudah diperbarui
                    save_conversation_memories(memories)
                    # Update vectorstore dengan memori baru
                    if vectorstore is not None:
                        vectorstore = merge_memories_with_knowledge(vectorstore, detected)
                    print(f"✓ Informasi baru tercatat: {', '.join(detected)}")
                continue
            
            # Jika tidak perintah device, gunakan RAG dengan knowledge base
            if vectorstore is not None:
                # Ambil konteks relevan dari knowledge base
                context = retrieve_relevant_context(vectorstore, user_input, k=3)
                
                # Generate response dengan context knowledge base dan memori
                response = generate_response("ollama", context, user_input, vectorstore, memories)
                print(f"\nAgent: {response}")
                
                # Deteksi informasi baru dari percakapan ini
                detected = detect_new_memory(user_input, memories)
                if detected:
                    memories.extend(detected)
                    # Simpan memori yang sudah diperbarui
                    save_conversation_memories(memories)
                    # Update vectorstore dengan memori baru
                    if vectorstore is not None:
                        vectorstore = merge_memories_with_knowledge(vectorstore, detected)
                    print(f"✓ Informasi baru tercatat: {', '.join(detected)}")
            else:
                # Fallback: Ollama dengan memori percakapan (knowledge base file kosong)
                response = generate_response("ollama", "", user_input, None, memories)
                print(f"\nAgent: {response}")
                
                # Deteksi informasi baru dari percakapan ini
                detected = detect_new_memory(user_input, memories)
                if detected:
                    memories.extend(detected)
                    save_conversation_memories(memories)
                    print(f"✓ Informasi baru tercatat: {', '.join(detected)}")
        
        except (KeyboardInterrupt, EOFError):
            # Simpan memori sebelum keluar
            save_conversation_memories(memories)
            print("\n\nDiterima perintah keluar. Sampai jumpa! Memori disimpan.")
            break
        except Exception as e:
            print(f"\nError: {str(e)}")
            print("Silakan coba lagi atau ketik 'exit' untuk keluar.")

if __name__ == "__main__":
    main()