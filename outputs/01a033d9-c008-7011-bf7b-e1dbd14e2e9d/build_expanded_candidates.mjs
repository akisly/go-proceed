import fs from "node:fs/promises";

const OUT_DIR = "/Users/akisliy/Downloads/GoProceed/outputs/01a033d9-c008-7011-bf7b-e1dbd14e2e9d";

const verticals = {
  roofing_waterproofing: {
    segment: "Покрівлі та гідроізоляція",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 0,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 4,
    buyer_fit: 5,
    target_role: "Власник / директор; керівник проєктів; виконроб",
    trigger: "Пароізоляція, утеплення, кріплення, шви й примикання стають недоступними після завершення покрівельного пирога.",
  },
  facade: {
    segment: "Вентильовані фасади та скління",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 0,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 4,
    buyer_fit: 5,
    target_role: "Власник / директор; керівник фасадних проєктів; ПТО",
    trigger: "Кронштейни, анкери, утеплення, мембрани й протипожежні відсічки закриваються облицюванням.",
  },
  industrial_floors: {
    segment: "Промислові підлоги та бетон",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 0,
    workflow_fit: 5,
    hidden_intensity: 4,
    docs_signal: 4,
    buyer_fit: 5,
    target_role: "Власник / директор; керівник проєктів; технолог / ПТО",
    trigger: "Підготовка основи, армування, шви, вологість і технологічні шари потрібно зафіксувати до заливки або нанесення фінішу.",
  },
  piles_foundations: {
    segment: "Палі, фундаменти та підсилення",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 0,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / директор; головний інженер; керівник ПТО",
    trigger: "Армування, глибина, бетонування, журнали та випробування паль критичні до засипки й наступних конструкцій.",
  },
  structural_steel: {
    segment: "Металоконструкції та промисловий монтаж",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 1,
    workflow_fit: 4,
    hidden_intensity: 3,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / директор; головний інженер; керівник монтажу / ПТО",
    trigger: "Зварні й болтові з’єднання, антикорозійний шар, геометрія та акти випробувань формують пакет до приймання.",
  },
  passive_fire: {
    segment: "Пасивний вогнезахист",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 1,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / директор; керівник проєктів; відповідальний за якість",
    trigger: "Товщина покриття, підготовка поверхні, кабельні проходки й сертифіковані матеріали потребують доказів до закриття оздобленням.",
  },
  industrial_insulation: {
    segment: "Промислова теплоізоляція",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 1,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 4,
    buyer_fit: 5,
    target_role: "Директор; головний інженер; керівник промислового монтажу",
    trigger: "Стан трубопроводу, товщина й суцільність ізоляції закриваються металевим кожухом; важливі фото по етапах.",
  },
  scs_bms: {
    segment: "СКС, BMS та слаботочна інтеграція",
    route: "Discovery — частково Н.15 + вимоги проєкту",
    current_requirement_coverage: 3,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / комерційний директор; керівник проєктів; ПТО",
    trigger: "Кабельні траси над стелями, маркування, тестування портів і пусконалагодження мають бути доведені до закриття та здачі системи.",
  },
  cleanrooms: {
    segment: "Чисті приміщення та стерильні зони",
    route: "Discovery — частково Н.14/Н.15 + вимоги проєкту",
    current_requirement_coverage: 3,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Комерційний директор; керівник проєктів; QA / валідація",
    trigger: "Герметичність огороджень, HEPA-вентиляція, автоматика й кваліфікаційні протоколи утворюють дуже насичений пакет приймання.",
  },
  elevators: {
    segment: "Ліфти, ескалатори та підйомники",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 1,
    workflow_fit: 4,
    hidden_intensity: 4,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Директор; керівник монтажу; відповідальний за введення в експлуатацію",
    trigger: "Закладні, напрямні, електрика, випробування й постановка на облік мають поетапну приймальну документацію.",
  },
  pools: {
    segment: "Басейни, водні комплекси та SPA",
    route: "Discovery — частково Н.14/Н.15 + вимоги проєкту",
    current_requirement_coverage: 3,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / директор; керівник будівництва; головний інженер",
    trigger: "Закладні, трубопроводи, гідроізоляція, електрика й автоматика закриваються чашею та оздобленням.",
  },
  roads: {
    segment: "Дорожні роботи та благоустрій",
    route: "Discovery — вимоги проєкту",
    current_requirement_coverage: 0,
    workflow_fit: 5,
    hidden_intensity: 5,
    docs_signal: 5,
    buyer_fit: 5,
    target_role: "Власник / директор; головний інженер; лабораторія / ПТО",
    trigger: "Основа, шари покриття, ущільнення та лабораторні протоколи стають недоступними після наступного шару.",
  },
};

const companies = [
  // Roofing and waterproofing
  ["ATNI GROUP", "atnigroup.com.ua", "roofing_waterproofing", 4, 5, "ПВХ/ТПО мембрани, утеплення і реалізовані покрівлі 420–4670 м²."],
  ["СпецІзол", "spetsizol.com.ua", "roofing_waterproofing", 4, 5, "Портфоліо промислових і приватних мембранних покрівель; проєкти 600–1500 м²."],
  ["БК МД ГРУП", "bkmdgroup.com", "roofing_waterproofing", 4, 5, "Монтаж ПВХ-мембран під ключ для комерційних і виробничих об’єктів по Україні."],
  ["Укргідроізол", "ukrgidroizol.com.ua", "roofing_waterproofing", 4, 5, "15+ років у ПВХ/ТПО покрівлях; повний покрівельний пиріг і галерея робіт."],
  ["ПРОФ-ІНВЕСТ ГРУП", "profinvestgrup.com.ua", "roofing_waterproofing", 4, 5, "17+ років і понад 150 000 м² змонтованих мембран по Україні."],
  ["Budroof", "budroof.ua", "roofing_waterproofing", 5, 5, "Понад 1,5 млн м² ПВХ/ТПО та гідроізоляційних мембран; спеціалізований монтаж."],
  ["ТК Три Кита", "tk-build.kiev.ua", "roofing_waterproofing", 4, 5, "Портфоліо 300+ приватних і промислових покрівель по Україні."],
  ["ПОКРИВ", "pokryv.com.ua", "roofing_waterproofing", 4, 5, "Портфоліо ПВХ/ТПО покрівель, терас, басейнів і промислових об’єктів."],
  ["AMKO", "amko.com.ua", "roofing_waterproofing", 4, 5, "Повний цикл мембранної покрівлі: основа, шари, шви, примикання й контроль."],
  ["GRD MEMBRANA", "grdmembrana.com.ua", "roofing_waterproofing", 3, 5, "Мембранні промислові покрівлі та ремонти в Закарпатті."],
  ["VEMAKS", "vemaks.com.ua", "roofing_waterproofing", 4, 5, "Публічний кейс ПВХ-покрівлі супермаркету АТБ з опрацюванням вузлів і гарантією."],

  // Facades
  ["НВФ-БУД МОНТАЖ", "nvf-group.com.ua", "facade", 4, 5, "Проєктування й монтаж вентильованих фасадів по Україні; кілька типів облицювання."],
  ["УКРФАСАДМОНТАЖ", "facade-ua.com", "facade", 4, 5, "Фасадне скління, вентильовані фасади з утепленням і портфоліо бізнес-об’єктів."],
  ["Astreya Aluminum Systems", "astreyaua.com", "facade", 5, 5, "20 000+ м² фасадів на рік, проєктний відділ, власні монтажні бригади й обладнання."],
  ["EKZO.HAUS", "ekzo.haus", "facade", 4, 5, "Виробництво систем і організація монтажних бригад для вентфасадів та покрівель."],
  ["SCANROC Україна", "scanroc.ua", "facade", 5, 3, "Близько 5 млн м² змонтованих фасадних систем; великий перелік реалізованих об’єктів."],

  // Floors and concrete
  ["КУБ Моноліт", "kubmonolit.com", "industrial_floors", 4, 5, "22 кейси бетонних підлог і 17 монолітно-каркасних об’єктів у портфоліо."],
  ["Olis-Group", "olis-group.com.ua", "industrial_floors", 5, 5, "1850+ промислових підлог для великих заводів і харчових підприємств."],
  ["DENBETON", "denbeton.com.ua", "industrial_floors", 5, 5, "200+ проєктів і 645 000 м² промислових підлог; власний масштаб виконання."],
  ["БСК Poliflo", "poliflo.com.ua", "industrial_floors", 4, 5, "Портфоліо полімерних, бетонних і топінгових підлог з вимогами замовників."],
  ["БК ЮММА", "umma-bud.com.ua", "industrial_floors", 4, 5, "Промислові бетонні підлоги для виробництв, логістики, торгівлі й медичних об’єктів."],

  // Piles and structural repair
  ["УМБК Underground", "underground.org.ua", "piles_foundations", 4, 5, "Буроін’єкційні, мікро-, забивні та буронабивні палі; портфоліо житлових і промислових об’єктів."],
  ["PALI", "pali.com.ua", "piles_foundations", 5, 5, "12+ років, палі до 32 м, промислові та комерційні об’єкти по Україні."],
  ["PILLAR", "pillar.ua", "piles_foundations", 5, 5, "1000+ об’єктів; повний цикл геошурупних фундаментів і металоконструкцій."],
  ["ФУНДАМЕНТСПЕЦБУД", "fsbud.com.ua", "piles_foundations", 5, 5, "30+ років і тисячі пальових фундаментів; статичні випробування та промислові об’єкти."],
  ["Олімпія Білд", "olympia-build.com.ua", "piles_foundations", 4, 5, "Спеціаліст з пальових фундаментів, геології, геодезії та супутніх робіт."],
  ["Кремінь Груп", "cremen.com.ua", "piles_foundations", 5, 5, "Пальові фундаменти й статичні випробування на промислових та інфраструктурних об’єктах."],
  ["GIDROSTOP", "gidrostop.com.ua", "piles_foundations", 4, 5, "Торкретування, армування й гідроізоляція промислових печей, мостів, фундаментів і резервуарів."],

  // Structural steel
  ["M7 Construction", "m7construction.com.ua", "structural_steel", 4, 5, "Промислові будівлі, склади, металоконструкції, сендвіч-панелі й монтаж."],
  ["ALATEKS", "alateks.net", "structural_steel", 4, 5, "Повний цикл металоконструкцій для промислових, аграрних та інженерних об’єктів."],
  ["РИТМ КИЇВ", "ritm.com.ua", "structural_steel", 5, 5, "Промисловий монтаж з 1991 року, випробування та введення об’єктів в експлуатацію."],
  ["STERNAT", "sternat.com.ua", "structural_steel", 4, 5, "Виготовлення та монтаж металоконструкцій від ангарів до індивідуальних рішень."],
  ["СЕРВІССТРОЙ", "servicestroy.com.ua", "structural_steel", 4, 5, "17 років; портфоліо складів, супермаркетів і великих металоконструкцій."],
  ["Святобуд", "svbud.com.ua", "structural_steel", 4, 5, "Монтаж і захист металоконструкцій та покрівель на об’єктах по Україні."],

  // Passive fire
  ["DEFENS", "defens.ua", "passive_fire", 4, 5, "Власне виробництво та нанесення вогнезахисних покриттів на металоконструкції."],
  ["Системи Вашої Безпеки", "svb.com.ua", "passive_fire", 4, 5, "Обробка дерева, металу й кабельних проходок з актами для перевірок."],
  ["Kovlar Group", "kovlargroup.com", "passive_fire", 5, 5, "Проєктування, експертиза, лабораторні випробування й здача-приймання вогнезахисту."],
  ["Sand Trade", "sandtrade.com.ua", "structural_steel", 4, 5, "Виїзне очищення, фарбування й підготовка великих металоконструкцій до нанесення вогнезахисту."],
  ["Український центр технічної безпеки", "uctb.ua", "passive_fire", 4, 5, "Проєктування, монтаж і пусконалагодження протипожежних систем та вогнезахисної обробки."],
  ["СПЕЦПОЖЗАХИСТ-УКРАЇНА", "spz-bc.com.ua", "passive_fire", 4, 5, "Проєктування й монтаж під ключ у пожежній та техногенній безпеці."],

  // Industrial insulation
  ["ORION GROUP", "oriongr.com", "industrial_insulation", 5, 5, "30+ років; ізоляція трубопроводів і ємностей у pharma, food, chemical та energy."],
  ["ІНКРАФТ", "inkraft.com.ua", "industrial_insulation", 3, 5, "Монтаж ізоляції трубопроводів, резервуарів, вентиляції та кріогенних систем."],
  ["ЕНРЕМО", "enremo.ua", "industrial_insulation", 4, 5, "Ізоляція трубопроводів, резервуарів, газоходів і обладнання ТЕС/ТЕЦ та промисловості."],

  // SCS and BMS
  ["VERNA", "verna.ua", "scs_bms", 5, 5, "100 000+ портів і сотні компаній; кейс 30 магазинів та 1000+ портів."],
  ["C&S", "cs-ua.com", "scs_bms", 5, 5, "220+ проєктів СКС для промислової, комерційної та житлової нерухомості."],
  ["Smart Systems", "smartsys.team", "scs_bms", 3, 5, "Проєктування, монтаж і тестування СКС для офісів, бізнес-центрів та інфраструктури."],
  ["MatiasBud", "matiasbud.com.ua", "scs_bms", 5, 5, "Велике портфоліо СКС, відеонагляду й доступу для ЖК, ТРЦ, шкіл і бізнес-центрів."],
  ["Kristall Systems", "kristall-systems.net.ua", "scs_bms", 4, 5, "Проєктування, монтаж, тестування, сертифікація СКС і виконавча документація."],
  ["EA Solutions", "easolutions.com.ua", "scs_bms", 5, 5, "Промислова автоматизація, електрозабезпечення, HVAC, телемеханіка й СКС у багатьох галузях."],
  ["SOLTI", "solti.ua", "scs_bms", 4, 5, "Кейси проєктування, монтажу та пусконалагодження СКС з гарантійним обліком."],
  ["Ksimex", "ksimex.ua", "scs_bms", 4, 5, "BMS-проєкти для готелів, ТРЦ і бізнес-центрів; монтаж та пусконалагодження."],
  ["IT-Integrator", "it-integrator.ua", "scs_bms", 5, 4, "СКС, електротехнічні рішення, кондиціонування й фізична безпека для великих підприємств."],

  // Cleanrooms
  ["POLIKOR", "polikor.com.ua", "cleanrooms", 5, 5, "230+ зданих чистих приміщень; виробництво, вентиляція, автоматика й монтаж з 1993 року."],
  ["Cleanroom / ECOTEP", "cleanroom.com.ua", "cleanrooms", 4, 5, "Портфоліо стерильних медичних і фармацевтичних зон з вимогами до вентиляції та огороджень."],
  ["Hospital Room", "hospitalroom.com.ua", "cleanrooms", 4, 5, "Чисті приміщення, медичні гази, HVAC і стерильні зони з введенням в експлуатацію."],

  // Elevators
  ["ЄВРОЛІФТ", "eurolift.com.ua", "elevators", 5, 5, "Поставка, монтаж і гарантійна підтримка ліфтів, ескалаторів та підйомників; велике портфоліо."],
  ["LSK", "lsk.com.ua", "elevators", 5, 5, "20 років, 1000+ об’єктів; від проєкту й монтажу до постановки на облік."],
  ["СІТІ ЛІФТ", "citylift.com.ua", "elevators", 4, 5, "Проєктування, монтаж і здача під ключ за ДБН по всій Україні."],
  ["BRAVO Lift", "bravo-lift.com", "elevators", 4, 5, "Виробництво, монтаж та обслуговування ліфтів, ескалаторів і підйомників."],
  ["UNIT-L", "unit-l.com", "elevators", 3, 5, "Монтаж по Україні, технічний огляд, ремонт і сертифіковане обладнання."],

  // Pools
  ["Imperial Pools", "imperialpools.com.ua", "pools", 4, 5, "Проєктування й будівництво басейнів під ключ з філіями по Україні."],
  ["ATM Pool", "atmpool.com", "pools", 5, 5, "30+ років у громадських і спортивних басейнах; проєктування, монтаж, реконструкція й сервіс."],
  ["БРАС-ГРУП", "brasgroup.com.ua", "pools", 4, 5, "Будівництво, реконструкція, автоматизація та сервіс приватних і комерційних басейнів."],

  // Roads
  ["Магістраль Асфальт", "magistralasfalt.com.ua", "roads", 4, 5, "Повний цикл дорожніх робіт з власною технікою, пошаровою здачею й гарантією."],
];

const candidates = companies.map(([company_name, domain, vertical, scale_signal, reachability, fit_evidence]) => {
  const d = verticals[vertical];
  return {
    company_name,
    domain,
    vertical,
    segment: d.segment,
    account_type: d.buyer_fit >= 4 ? "specialist_contractor" : "channel_or_general_contractor",
    route: d.route,
    current_requirement_coverage: d.current_requirement_coverage,
    workflow_fit: d.workflow_fit,
    hidden_intensity: d.hidden_intensity,
    scale_signal,
    docs_signal: d.docs_signal,
    buyer_fit: d.buyer_fit,
    reachability,
    fit_evidence,
    pilot_trigger: d.trigger,
    target_role: d.target_role,
    source_url: `https://${domain}/`,
    research_status: "official_site_search_verified",
    research_date: "2026-08-24",
    evidence_confidence: "high",
  };
});

const sourceOverrides = {
  "spetsizol.com.ua": "https://spetsizol.com.ua/ua/photos",
  "bkmdgroup.com": "https://www.bkmdgroup.com/service/montazh-pvx-membany",
  "budroof.ua": "https://budroof.ua/uk/services/montazh-pvh-membrany/",
  "tk-build.kiev.ua": "https://www.tk-build.kiev.ua/portfolio-pokrivelnyh-robit/",
  "pokryv.com.ua": "https://pokryv.com.ua/gallery.html",
  "amko.com.ua": "https://amko.com.ua/pokrivelni-roboty/montazh-pvkh-membrany/",
  "vemaks.com.ua": "https://vemaks.com.ua/our_objects/ustroystvo-pvkh-krovli-supermarketa-atb-v-g-poltava/",
  "kubmonolit.com": "https://kubmonolit.com/portfolio/",
  "poliflo.com.ua": "https://poliflo.com.ua/portfolio",
  "pillar.ua": "https://pillar.ua/pro-nas/",
  "fsbud.com.ua": "https://fsbud.com.ua/objects/",
  "gidrostop.com.ua": "https://gidrostop.com.ua/ukriplennya-konstrukczij/",
  "m7construction.com.ua": "https://m7construction.com.ua/projects",
  "servicestroy.com.ua": "https://servicestroy.com.ua/galereya-robit/",
  "svbud.com.ua": "https://svbud.com.ua/stroitelinie-rabotu/",
  "svb.com.ua": "https://svb.com.ua/poslugi/vognezahisna-obrobka/",
  "kovlargroup.com": "https://kovlargroup.com/uk/services/services-uk/",
  "sandtrade.com.ua": "https://www.sandtrade.com.ua/",
  "oriongr.com": "https://oriongr.com/montazhni-roboty/izoliatsijni-roboty/",
  "inkraft.com.ua": "https://inkraft.com.ua/ua/g2706778-izolyatsiionnye-uslugi",
  "enremo.ua": "https://www.v.enremo.ua/uk/services",
  "verna.ua": "https://www.verna.ua/projects/implementation-network-eldorado",
  "smartsys.team": "https://smartsys.team/uk/kabelni-systemy/",
  "matiasbud.com.ua": "https://matiasbud.com.ua/portfolio",
  "kristall-systems.net.ua": "https://www.kristall-systems.net.ua/ua/uslugi/structured_cabling_system/",
  "easolutions.com.ua": "https://easolutions.com.ua/projects",
  "solti.ua": "https://www.solti.ua/systemna-integraciya/inzhenerni-systemy/strukturovana-kabelna-systema-sks/",
  "ksimex.ua": "https://www.ksimex.ua/subprojects/bms",
  "cleanroom.com.ua": "https://www.cleanroom.com.ua/ua/proekti/",
  "hospitalroom.com.ua": "https://www.hospitalroom.com.ua/clean-room",
  "imperialpools.com.ua": "https://imperialpools.com.ua/portfolio",
};
for (const candidate of candidates) {
  if (sourceOverrides[candidate.domain]) candidate.source_url = sourceOverrides[candidate.domain];
}

const domainSet = new Set(candidates.map(x => x.domain));
if (domainSet.size !== candidates.length) throw new Error(`Duplicate domains in expanded pool: ${candidates.length - domainSet.size}`);

await fs.writeFile(`${OUT_DIR}/expanded_candidates_2026-08-24_raw.json`, JSON.stringify(candidates, null, 2), "utf8");
console.log(JSON.stringify({ count: candidates.length, byVertical: candidates.reduce((acc, x) => { acc[x.vertical] = (acc[x.vertical] || 0) + 1; return acc; }, {}) }, null, 2));
