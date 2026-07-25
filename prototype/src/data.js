export const workItems = [
  { id: 'EL-04.17', name: 'Прокладання кабелю ВВГнг 5×16', location: 'Секція B · 4 поверх', owner: 'С. Коваль', performed: 482400, ready: 278000, issue: 'Фото до закриття', state: 'risk', due: 'Сьогодні' },
  { id: 'EL-07.02', name: 'Монтаж кабельних лотків 200 мм', location: 'Секція A · -1 поверх', owner: 'І. Бондар', performed: 318000, ready: 238500, issue: 'Погодження обсягу', state: 'review', due: '1 день' },
  { id: 'EL-11.08', name: 'Встановлення щита ЩР-12', location: 'Секція C · 7 поверх', owner: 'М. Литвин', performed: 196000, ready: 98000, issue: 'Виконавча схема', state: 'risk', due: '2 дні' },
  { id: 'EL-03.21', name: 'Прокладання гофротруби Ø25', location: 'Секція A · 8 поверх', owner: 'О. Шевчук', performed: 172000, ready: 172000, issue: 'Комплект доказів', state: 'ready', due: 'Готово' },
  { id: 'EL-09.05', name: 'Монтаж світильників аварійних', location: 'Паркінг · P2', owner: 'С. Коваль', performed: 143600, ready: 107700, issue: '1 фото з 2', state: 'risk', due: '3 дні' },
  { id: 'EL-14.01', name: 'Вимірювання опору ізоляції', location: 'Секція B · стояк', owner: 'І. Бондар', performed: 124000, ready: 124000, issue: 'Протокол прийнято', state: 'ready', due: 'Готово' },
]

export const packages = [
  { version: 'AVR-2026-06 · v2', project: 'БЦ Horizon', period: 'Червень 2026', amount: '2 650 000 ₴', status: 'Готово до подання', tone: 'ready', updated: 'Сьогодні, 10:42' },
  { version: 'AVR-2026-05 · v3', project: 'БЦ Horizon', period: 'Травень 2026', amount: '2 180 000 ₴', status: 'Прийнято', tone: 'blue', updated: '12.06.2026' },
  { version: 'AVR-2026-06 · v1', project: 'Логістичний парк West', period: 'Червень 2026', amount: '1 420 000 ₴', status: '11 блокерів', tone: 'risk', updated: 'Вчора, 18:20' },
  { version: 'AVR-2026-05 · v1', project: 'ЖК Riverline', period: 'Травень 2026', amount: '960 000 ₴', status: 'Оплачено', tone: 'ink', updated: '03.06.2026' },
]

export const formatMoney = (value) => new Intl.NumberFormat('uk-UA').format(value) + ' ₴'
