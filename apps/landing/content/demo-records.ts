/**
 * The demonstration records the visuals draw. Plausible Ukrainian
 * construction records, no customer data — the footer disclaimer labels them
 * on every render (PRODUCT.md §Capabilities and Constraints).
 */
export type BoardTone = "ready" | "review" | "blocked";
export type BoardCard = { code: string; title: string; tag: string; tone: BoardTone; selected?: boolean };

export const demoRecords = {
  board: {
    project: "БЦ Поділ",
    scope: "Приховані роботи · Секція А",
    tabs: ["Список", "Стан", "Акти"],
    activeTab: "Стан",
    columns: [
      { id: "ready", label: "Готово", count: 12, tone: "ready", cards: [
        { code: "W-012 · R-038", title: "Армування плити, захватка 2", tag: "закриття дозволено", tone: "ready" },
        { code: "W-016 · R-044", title: "Гідроізоляція санвузлів, 4 поверх", tag: "закриття дозволено", tone: "ready" },
        { code: "W-019 · R-046", title: "Закладні у стінах, секція Б", tag: "закриття дозволено", tone: "ready" },
      ] },
      { id: "review", label: "На розгляді", count: 7, tone: "review", cards: [
        { code: "W-014 · R-041", title: "Монтаж кабельних трас", tag: "EV-0248 · 14:32", tone: "review", selected: true },
        { code: "W-017 · R-047", title: "Трубопроводи в стяжці, коридор", tag: "очікує рішення", tone: "review" },
      ] },
      { id: "blocked", label: "Заблоковано", count: 3, tone: "blocked", cards: [
        { code: "W-015 · R-052", title: "Утеплення фасаду, осі 1–4", tag: "1 з 2 матеріалів", tone: "blocked" },
        { code: "W-021 · R-055", title: "Гільзи у перекритті, зона С", tag: "доказу немає", tone: "blocked" },
      ] },
    ] satisfies readonly { id: string; label: string; count: number; tone: BoardTone; cards: readonly BoardCard[] }[],
  },
  receipt: {
    code: "EV-0248",
    when: "сьогодні · 14:32",
    photoCaption: "14:32 · ВРУ-1 · Секція А",
    rows: [
      { label: "Робота", value: "W-014 · ВРУ-1" },
      { label: "Вимога", value: "R-041 · до закриття стелі" },
      { label: "Автор", value: "Майстер дільниці" },
      { label: "Стан", value: "Очікує рішення", tone: "review" as const },
    ],
    pills: [
      { id: "closure", lead: "CL-017", text: "· запис закриття дозволено · 16:19" },
      { id: "decision", lead: "прийнято о 16:18", text: "Технагляд · " },
    ],
  },
  fig01: {
    chat: {
      title: "Бригада · Л-3",
      members: "47 учасників",
      messages: [
        { who: "Олег Т.", text: "Привезли лотки на 4-й, розвантажили біля ліфта", time: "09:12" },
        { who: "Ігор К.", photo: "other" as const, time: "10:05" },
        { who: "Ігор К.", text: "штроба по Б-3 готова", time: "10:05" },
        { who: "Марина (ПТВ)", me: true, text: "Хто сьогодні на об'єкті? Потрібен акт по гільзах", time: "11:40" },
        { who: "Олег Т.", text: "+", time: "11:41" },
        { who: "Ігор К.", photo: "tray" as const, text: "Лоток над ВРУ поставили, можна закривати?", time: "14:32", hit: true, missing: ["без осі", "без вимоги", "без рішення"] },
        { who: "Сергій Р.", text: "де ключі від щитової?", time: "14:50" },
        { who: "Ігор К.", text: "у Олега", time: "14:51" },
        { who: "Марина (ПТВ)", me: true, text: "Завтра бетон о 8, стелю на 4-му закриваємо після обіду", time: "16:02" },
        { who: "Ігор К.", photo: "other" as const, time: "16:40" },
        { who: "Ігор К.", text: "кріплення, теж 4-й", time: "16:40" },
        { who: "Сергій Р.", text: "ок", time: "16:41" },
        { who: "Олег Т.", text: "Стелю закрили, 4-й готовий", time: "18:15" },
      ],
      footer: { lead: "пошук «лоток»:", strong: "1 фото", tail: "серед 214 повідомлень · час є, осі й вимоги немає" },
    },
    record: {
      code: "EV-0248",
      state: "запис доказу · очікує рішення",
      photoCaption: "14:32 · ВРУ-1 · Секція А · вісь Б-4",
      rows: [
        { label: "Робота", value: "W-014 · Монтаж кабельних трас" },
        { label: "Вимога", value: "R-041 · лоток до закриття стелі" },
        { label: "Місце", value: "ВРУ-1 · Секція А · вісь Б-4 · +3.300" },
        { label: "Автор", value: "Ігор К. · майстер дільниці" },
        { label: "Час", value: "20.08.2026 · 14:32" },
        { label: "Рішення", value: "DR-0091 · прийнято технаглядом · 16:18", tone: "ready" as const },
      ],
    },
  },
  route: {
    requirement: {
      title: "R-041 · Кабельний лоток до закриття стелі", tag: "блокуюча",
      rows: [
        { label: "Джерело", value: "ДБН А.3.1-5:2016, п. 6.3" },
        { label: "Робота", value: "W-014 · Монтаж кабельних трас" },
        { label: "Місце", value: "ВРУ-1 · Секція А · відм. +3.300" },
        { label: "Момент", value: "до закриття стелі" },
        { label: "Матеріали", value: "2 фото · загальний вигляд і кріплення" },
      ],
      rule: { lead: "Правило.", text: "W-014 не може бути записана закритою, поки R-041 не має прийнятого доказу." },
    },
    capture: {
      title: "Фіксація · мобільний застосунок", tag: "сьогодні · 14:32",
      phone: { work: "W-014 · Кабельні траси", requirementLabel: "Вимога R-041", requirement: "Лоток до закриття стелі", shot: "Загальний вигляд · 1 з 2", action: "Зняти фото" },
      rows: [
        { label: "Час", value: "14:32 · сьогодні" }, { label: "Місце", value: "ВРУ-1 · Секція А" },
        { label: "Автор", value: "Майстер дільниці" }, { label: "Код", value: "EV-0248" },
      ],
    },
    review: {
      title: "Зовнішній перегляд", tag: "без облікового запису",
      url: "goproceed.app/r/7k2…f9 · доступ до R-041",
      rows: [{ label: "Вимога", value: "Кабельний лоток до закриття стелі" }, { label: "Матеріали", value: "2 фото · EV-0248 · 14:32" }],
      actions: [{ label: "Прийняти", active: true }, { label: "Повернути" }, { label: "Запитати уточнення" }],
      decision: "Рішення DR-0091 · О. Мельник · 16:18",
    },
    closure: {
      title: "Закриття · CL-017", tag: "дозволено",
      log: [
        { time: "14:32", code: "EV-0248", text: "матеріал додано", tags: [{ label: "майстер" }, { label: "на розгляді", tone: "review" as const }] },
        { time: "14:33", text: "походження зафіксовано", tags: [{ label: "система" }, { label: "застосунок" }] },
        { time: "16:18", code: "DR-0091", text: "матеріал прийнято", tags: [{ label: "технагляд" }, { label: "прийнято", tone: "ready" as const }] },
        { time: "16:19", code: "CL-017", text: "запис закриття дозволено", tags: [{ label: "система" }, { label: "закрито", tone: "ready" as const }] },
      ],
      rule: { lead: "Запис закриття", text: "посилається на рішення DR-0091." },
    },
    act: {
      title: "Чернетка акта · Додаток В", tag: "з 4 фактів", stamp: "ЧЕРНЕТКА", heading: "Акт освідчення прихованих робіт",
      rows: [
        { label: "Роботи", value: "Монтаж кабельних трас, ВРУ-1, секція А" },
        { label: "Вимога", value: "ДБН А.3.1-5:2016 · R-041" },
        { label: "Докази", value: "EV-0248 · 2 фото · 14:32" },
        { label: "Рішення", value: "DR-0091 · прийнято технаглядом · 16:18" },
        { label: "Закриття", value: "CL-017 · 16:19" },
      ],
    },
  },
  channels: {
    telegram: [
      { me: true, photo: true, text: "Лоток над ВРУ-1, секція А" },
      { me: false, text: "Знайшов W-014. Це для R-041 «до закриття стелі»?" },
      { me: true, text: "Так" },
      { me: false, text: "Збережено як EV-0248. Передано на розгляд.", strong: "EV-0248" },
    ],
    app: { header: "W-014 · R-041", rows: [{ title: "Загальний вигляд", text: "1 з 2 · зняти" }, { title: "Черга відправки", text: "EV-0251 · очікує мережу" }] },
    web: [{ left: "W-014 · R-041", right: "на розгляді" }, { left: "EV-0248 · 14:32", right: "доказ" }, { left: "DR-0091 · технагляд", right: "прийнято" }],
  },
} as const;
