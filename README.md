# RAG - Agent AI Pribadi dengan Ollama

Aplikasi ini membuat asisten AI lokal di laptop Anda menggunakan Ollama, dengan kemampuan:
- Mengenali diri Anda melalui knowledge base pribadi
- Berinteraksi dengan device Windows
- Memproses pertanyaan menggunakan data pribadi Anda

## Struktur Proyek

```
RAG/
├── .git/
├── data/
│   ├── personal/        # Tempat menyimpan data diri Anda (catatan, dokument, dll)
│   └── knowledge-base/  # Vektor database hasil processing data pribadi
├── src/
│   └── agent/
│       └── main.py      # Kode utama aplikasi asisten AI
├── requirements.txt     # Dependencies Python
├── .env                 # Konfigurasi environment (model Ollama, path data)
└── README.md            # Dokumentasi ini
```

## Cara Menjalankan

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Persiapan Data Pribadi
Masukkan file-file pribadi Anda ke dalam folder `data/personal/`:
- Catatan harian (.txt, .md)
- Dokument penting
- File-file lainnya yang ingin agent "kenal"

### 3. Jalankan Aplikasi
```bash
python src\agent\main.py
```

### 4. Pastikan Ollama Berjalan
Pastikan Ollama sudah running di background di laptop Anda dengan model yang terinstall:
```bash
ollama serve
# Atau cek model yang ada:
ollama list
```

## Fitur Utama

### 🤖 Knowledge Base Pribadi
Agent bisa "kenali" Anda melalui file yang Anda berikan di `data/personal/`. Setiap dokumen akan di-processing menjadi vektor dan disimpan untuk retrieve saat bertanya.

### 💻 Kontrol Device
Agent dapat berinteraksi dengan Windows device Anda:
- `device status battery` - Cek persentase baterai
- `device status sistem` - Cek CPU, Memory, Disk usage
- `device buka <nama>` - Buka aplikasi (contoh: `device buka notepad`)
- `device tutup semua` - Tutup aplikasi standar
- `device lokasi saat ini` - Dapatkan home directory

### 🔄 RAG (Retrieval Augmented Generation)
Saat Anda bertanya, agent akan:
1. Terlebih dahulu mencari relevansi di knowledge base pribadi
2. Jika ditemukan, jawab berdasarkan data Anda
3. Jika tidak ditemukan, gunakan Ollama sebagai fallback

### 💾 Memory Sesi
Agent "ingat" konteks percakapan dalam satu sesi menjalankan program.

## Menambahkan Data Baru

Untuk memperbarui knowledge base:
1. Tambahkan file ke `data/personal/`
2. Jalankan ulang aplikasi (knowledge base akan refresh otomatis)
   Atau jalankan manual: `python -c "from src.agent.main import load_personal_knowledge; load_personal_knowledge()"`

## Konfigurasi (.env)

Edit file `.env` untuk mengubah:
- `OLLAMA_MODEL`: Nama model Ollama (default: `llama3.2`)
- `OLLAMA_HOST`: Alamat host Ollama (default: `http://localhost:11434`)
- `PERSONAL_DATA_PATH`: Path ke folder data pribadi
- `KNOWLEDGE_BASE_PATH`: Path ke knowledge base

## Development

### Menambahkan Fitur Baru
1. Tambahkan fungsi di `interact_with_device()` di `src/agent/main.py`
2. Atau tambahkan kondisi baru di main loop

### Customizing Prompt
Anda bisa menambahkan prompt sistem personal di awal `main.py` untuk memberi identitas khusus agent.

## Catatan Penting

- Aplikasi ini berjalan **lokal** - data Anda tidak keluar dari laptop
- Butuh koneksi internet hanya saat pertama kali pull model Ollama
- Untuk Windows - fitur device beroptimalkan untuk sistem operasi ini
- Pastikan Ollama terinstall dan model sudah di-pull sebelum menjalankan