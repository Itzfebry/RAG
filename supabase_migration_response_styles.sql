-- Gaya respons (response_styles). Jalankan sekali di Supabase SQL Editor.
-- Satu baris, kolom `styles` berisi array JSON: [{id, name, description, prompt}, ...].
-- Idempoten: aman dijalankan ulang.

create table if not exists public.response_styles (
  id          int primary key default 1,
  styles      jsonb not null default '[]'::jsonb,
  updated_at  text
);

insert into public.response_styles (id, styles, updated_at)
values (
  1,
  '[
    {
      "id": "ringkas",
      "name": "Sangat Ringkas",
      "description": "Jawaban super singkat langsung ke inti. Bullet rapat, tanpa basa-basi.",
      "prompt": "Balas singkat dan langsung ke inti, tanpa pembuka atau basa-basi. Tetap pakai format kaya: **bold** untuk poin kunci, numbering untuk langkah, bullet untuk daftar, dan spasi antar bagian. Batasi jumlah poin, bukan format. Tambahkan detail hanya jika user minta."
    },
    {
      "id": "edukatif",
      "name": "Guru Penjelas",
      "description": "Penjelasan panjang, sabar, bertahap dengan analogi dan contoh.",
      "prompt": "Gaya mengajar yang sabar dan detail. Jelaskan konsep dari dasar, gunakan analogi dan contoh nyata, pecah jadi langkah-langkah bernomor, dan ulangi poin penting dengan kalimat berbeda bila perlu. Tidak apa-apa panjang asalkan mudah dipahami pemula."
    },
    {
      "id": "santai",
      "name": "Santai & Asik",
      "description": "Ngobrol santai seperti dengan teman, humor ringan, gaya kasual.",
      "prompt": "Gaya ngobrol santai seperti bicara dengan teman dekat. Gunakan bahasa kasual sehari-hari, boleh humor ringan dan opini personal. Format tetap rapi dengan **bold** untuk poin penting dan spasi antar bagian, tapi hindari heading formal. Sapa dengan akrab."
    }
  ]'::jsonb,
  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS')
)
on conflict (id) do nothing;

-- Sama seperti tabel lain: hanya service role yang boleh akses.
alter table public.response_styles enable row level security;
