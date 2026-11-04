import { notFound } from 'next/navigation';

/** Bilinmeyen her adres, dile uygun "bulunamadı" sayfasına düşer (Next'in İngilizce varsayılanına değil). */
export default function CatchAll() {
  notFound();
}
