const NICKNAME_LIST = [
  '개구리',
  '메뚜기',
  '멸치',
  '너구리',
  '코끼리',
  '올빼미',
];
export default function generateNickname(): string {
  const randomIndex = Math.floor(Math.random() * NICKNAME_LIST.length);
  return NICKNAME_LIST[randomIndex];
}
