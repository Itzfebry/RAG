import os
import requests
from langchain_text_splitters import CharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import psutil
import win32com.client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# 1. Load knowledge base pribadi dari file-file di data/personal
def load_personal_knowledge():
    documents = []
    personal_dir = os.path.join(os.path.dirname(__file__), "..", "data", "personal")
    
    if not os.path.exists(personal_dir):
        print(f"Warning: Personal data directory not found at {personal_dir}")
        return None
    
    for filename in os.listdir(personal_dir):
        file_path = os.path.join(personal_dir, filename)
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if content.strip():
                    # Simpan sebagai teks biasa dengan metadata source
                    documents.append({"content": content, "source": filename})
        except Exception as e:
            print(f"Error reading {filename}: {e}")
    
    if not documents:
        print("No documents found in personal directory.")
        return None
    
    # Split menjadi chunks
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=20)
    
    # Split semua konten menjadi chunks
    all_texts = []
    for doc in documents:
        chunks = text_splitter.split_text(doc["content"])
        for i, chunk in enumerate(chunks):
            all_texts.append({"content": chunk, "source": f"{doc['source']}_chunk_{i}"})
    
    if not all_texts:
        print("No text chunks generated.")
        return None
    
    # Buat embeddings menggunakan model HuggingFace (bisa juga menggunakan Ollama embeddings)
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Ekstrak content dan metadatas untuk FAISS
    texts = [t["content"] for t in all_texts]
    metadatas = [t["source"] for t in all_texts]
    
    # Buat vector store FAISS
    vectorstore = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
    return vectorstore

# 2. Fungsi mendapatkan response dari Ollama
def get_ollama_response(prompt):
    """Get response from Ollama model directly via HTTP."""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=30
        )
        if response.status_code == 200:
            result = response.json()
            return result.get("response", "")
        else:
            return f"Error: Ollama returned status {response.status_code}"
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

# 4. Generate response dari LLM dengan context
def generate_response(llm_type, context, query):
    """Generate response menggunakan Ollama dengan memberikan context dan query."""
    if llm_type == "ollama":
        # Buat prompt dengan context
        if not context.strip():
            # Jika tidak ada context, hanya gunakan query langsung
            return get_ollama_response(query)
        
        prompt = f"Berikut adalah informasi yang relevan dari knowledge base pribadi:\n\n{context}\n\nBerikut adalah pertanyaan: {query}\n\nJawaban berdasarkan informasi di atas:"
        return get_ollama_response(prompt)
    else:
        # Fallback
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
            # Tutup aplikasi yang bisa ditutup via taskkill
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
    print("=== ASISTEN AI PRIBADI DENGAN OLLAMA ===")
    print("=" * 60)
    print("Sistem dimulai... Memuat knowledge base pribadi...")
    print()
    
    # Inisialisasi knowledge base
    vectorstore = load_personal_knowledge()
    
    if vectorstore is None:
        print("Warning: Knowledge base empty. Agent will operate only based on Ollama.")
    
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
                print("\nSampai jumpa! Agent menutup...")
                break
            
            # Cek perintah berinteraksi dengan device
            lower_input = user_input.lower()
            device_triggers = ["device ", "buka ", "status ", "tutup ", "lokasi"]
            
            handled = False
            for trigger in device_triggers:
                if lower_input.startswith(trigger):
                    response = interact_with_device(lower_input)
                    print(f"Agent: {response}")
                    handled = True
                    break
            
            if handled:
                continue
            
            # Jika tidak perintah device, gunakan RAG dengan knowledge base
            if vectorstore is not None:
                # Ambil konteks relevan
                context = retrieve_relevant_context(vectorstore, user_input, k=3)
                # Generate response dengan Ollama
                response = generate_response("ollama", context, user_input)
                print(f"\nAgent: {response}")
            else:
                # Fallback: langsung kepada Ollama tanpa RAG
                response = get_ollama_response(user_input)
                print(f"\nAgent: {response}")
        
        except KeyboardInterrupt:
            print("\n\nDiterima perintah keluar. Sampai jumpa!")
            break
        except Exception as e:
            print(f"\nError: {str(e)}")
            print("Silakan coba lagi atau ketik 'exit' untuk keluar.")

if __name__ == "__main__":
    main()