// Daftar slash command untuk UI. Sumber kebenaran perilaku ada di backend/agent/commands.py.
export interface ChatCommand {
  name: string;
  purpose: string;
  example: string;
}

export const CHAT_COMMANDS: ChatCommand[] = [
  { name: "purpose", purpose: "Tentukan tujuan dan fokus tugas.", example: "/purpose Launching produk UMKM 2 minggu" },
  { name: "explain", purpose: "Jelaskan konsep secara sistematis.", example: "/explain REST API" },
  { name: "calculate", purpose: "Hitung dan tampilkan prosesnya.", example: "/calculate 15% dari 850000" },
  { name: "summarize", purpose: "Ringkas tanpa kehilangan inti.", example: "/summarize [teks panjang]" },
  { name: "analyze", purpose: "Analisis kritis dan terstruktur.", example: "/analyze Next.js vs React untuk portfolio" },
  { name: "compare", purpose: "Bandingkan beberapa opsi.", example: "/compare Vercel vs VPS untuk FastAPI" },
  { name: "research", purpose: "Riset berbasis sumber (tanpa akses web).", example: "/research Perbedaan Gemini Flash dan Pro" },
  { name: "code", purpose: "Bantuan pemrograman teknis.", example: "/code Tambah endpoint health check" },
  { name: "debug", purpose: "Cari penyebab dan perbaikan error.", example: "/debug [error log]" },
  { name: "plan", purpose: "Susun rencana kerja bertahap.", example: "/plan Landing page dan pembayaran" },
  { name: "write", purpose: "Tulis atau perbaiki teks siap pakai.", example: "/write Pengumuman promo akhir tahun" },
  { name: "translate", purpose: "Terjemahkan natural.", example: "/translate Good morning" },
  { name: "decision", purpose: "Bantu keputusan dengan kriteria.", example: "/decision Supabase atau PostgreSQL self-host" },
];

// Command aktif dari teks input (di awal, berurutan, maks 2) - sama dengan parser backend.
export function activeCommandsFromInput(text: string): string[] {
  const out: string[] = [];
  let rest = text.trimStart();
  while (rest.startsWith("/")) {
    const m = rest.match(/^\/([a-zA-Z]+)(?=\s|$)/);
    if (!m) break;
    const name = m[1].toLowerCase();
    if (!CHAT_COMMANDS.some((c) => c.name === name)) break;
    if (!out.includes(name) && out.length < 2) out.push(name);
    rest = rest.slice(m[0].length).trimStart();
  }
  return out;
}

// Saran untuk token `/xxx` di akhir input: tampil saat pengguna sedang mengetik command pertama.
export function suggestCommands(text: string): ChatCommand[] {
  const m = text.match(/^\/([a-zA-Z]*)$/);
  if (!m) return [];
  const q = m[1].toLowerCase();
  return CHAT_COMMANDS.filter((c) => c.name.startsWith(q));
}
