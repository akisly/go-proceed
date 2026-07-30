# 02. Рынок и конкурентная стратегия

Дата свежей desk-research ревизии: **22.07.2026**. Feature/pricing/scale statements ниже взяты с публичных страниц самих vendors и являются vendor claims, а не независимым доказательством результата. Размер рынка, buyer urgency, willingness-to-pay и доступность конкретных customer artifacts пока не подтверждены интервью/сделками; этот документ задаёт гипотезу и kill criteria, а не объявляет PMF.

## 1. Категория

AktFlow находится на пересечении пяти категорий:

1. Field documentation / daily reporting.
2. Change order / variation management.
3. Construction billing / pay applications.
4. Construction document control / executive documentation.
5. Subcontractor financial exposure / closeout readiness.

Нельзя позиционировать продукт только в одной из первых четырёх категорий: там уже существуют зрелые решения. Собственная категория для входа:

> **Evidence readiness and revenue-at-risk for specialty contractors.**

## 2. Рыночный wedge

| Измерение | Выбор v1 |
|---|---|
| География | Украина |
| Сегмент | Электромонтажные MEP-субподрядчики |
| Размер | 15–100 сотрудников, 2–10 объектов |
| Контракты | Коммерческие/публичные, поэтапное закрытие |
| Buyer | Owner/commercial director |
| Champion | Head of PTO / project manager |
| Pain | Выполнено, но нельзя корректно предъявить |
| Trigger | Закрытие месяца, возврат акта, спорная допработа |
| Existing stack | Excel + messenger + АВК/BAS + Drive |

## 3. Размер доступного рынка

Широкий рынок включает тысячи строительных компаний, но реальный SAM ограничен фильтрами активных специализированных подрядчиков. Рабочая bottom-up оценка:

- 300–800 подходящих организаций в Украине;
- 100–250 достижимых первичных аккаунтов;
- 10–20 клиентов достаточно для $5k MRR при ARPA $250–500;
- Украина достаточна для bootstrapped solo SaaS, но для ARR выше нескольких миллионов долларов потребуется CEE.

Оценка должна быть заменена точной выгрузкой по КВЭД 43.21 (електромонтажні), 43.22 (водопровід/опалення/кондиціонування), 43.29 (інші будівельно-монтажні) с фильтрами: штат 15–100, 2–10 активных коммерческих объектов, наличие ПТО/сметчика. До этого `300–800` нельзя использовать как investor/marketing fact; это planning range для построения account list.

### Военная поправка 2026 (обязательна перед go/no-go)

SAM в военное время не совпадает с довоенным и должен оцениваться сценарно, а не одним числом:

- **Base (~0.7× SAM)**: мобилизация вымывает часть прорабов/ПТО (прямые пользователи), часть объектов заморожена, но коммерческое строительство в тыловых регионах продолжается.
- **Pessimistic (~0.4× SAM)**: усиление мобилизации, отток капитала, запрет фотофиксации у критической инфраструктуры делает ядро продукта (фото-capture) неприменимым на части объектов — сжимает и достижимый сегмент, и unit-надёжность.
- **Reconstruction (~1.5–2× SAM)**: программы восстановления и донорское финансирование расширяют число субподрядчиков с формализованным evidence-требованием (донорский аудит), что играет прямо на ценность продукта.

До подтверждённой КВЭД-выгрузки go/no-go на 12–18 месяцев принимается против **Base-сценария** с явной пометкой чувствительности к Pessimistic (запрет съёмки — экзистенциальный для продукта, см. doc 15).

## 4. Конкурентная карта

### 4.1 Прямые международные

#### Siteline

Что делает:

- pay apps по формам конкретного GC;
- compliance documents;
- change orders;
- lien waivers/rights;
- A/R reporting, collections, forecasting;
- интеграции с accounting/GC portals.

Свежий сигнал: vendor заявляет более $14B billed и 250k+ projects. Это подтверждает зрелость категории subcontractor billing, но цифры не являются независимым benchmark для AktFlow.

Что заимствуем:

- customer-specific form templates;
- единый billing status across projects;
- compliance expiry alerts;
- line-level reasons возврата;
- cash/aging visibility.

Что не копируем:

- US-specific lien/AIA model в ядре;
- office-first billing без field evidence;
- зависимость от библиотеки форм как единственного moat.

Наше улучшение:

- доказательства собираются до billing cutoff;
- rule engine связан с work type/location/timing;
- украинские исполнительные документы и ЄДЕССБ adapters.

#### Clearstory

Что делает:

- digital T&M tickets;
- фото, labor/material/equipment, signature;
- change order log;
- external review without account;
- pricing и conversion T&M → COR;
- revenue-at-risk / aging.

Свежий сигнал: позиционирование теперь прямо охватывает GC, specialty contractor и owner, real-time collaboration и ускорение closeout; значит `revenue at risk` нельзя считать свободной фразой или самостоятельным moat AktFlow.

Что заимствуем:

- no-account external link;
- field capture за секунды;
- master log across GC tools;
- change notice deadline и aging;
- one-click convert change to priced request.

Что улучшаем:

- не ограничиваемся extra work;
- связываем доказательства с основным contractual scope;
- readiness исполнительного пакета и скрытых работ;
- локальные подписи/КЕП как отдельный legal tier.

#### BauApp PAP

Что делает:

- partial acceptance protocol;
- contract/budget;
- multi-level approval;
- carry-over/deductions;
- payment/remaining contract value;
- audit trail.

Заимствуем:

- controlled period snapshots;
- carry-over без ручного копирования;
- approval stages;
- financial invariants.

Улучшаем:

- product is subcontractor-owned, not GC settlement only;
- evidence preflight до протокола;
- field-mobile first.

#### Raken / CompanyCam / PlanRadar / Fieldwire

Они доказывают стандарт ожиданий:

- offline;
- быстрые фото/видео;
- планы/локации;
- daily logs и PDF;
- tasks/issues/forms;
- роли и project collaboration.

Это table stakes, не дифференциация.

#### Praevius / PayProof / BuildWorkPro

Рынок продолжает фрагментироваться в сторону нишевых продуктов для specialty contractors:

- cost control/progress claims;
- recovery packets для уже неоплаченных работ;
- all-in-one для trade contractors.

Вывод: запуск generic subcontractor OS приведёт в перенасыщенную категорию. Wedge должен оставаться узким.

### 4.2 Локальные/региональные

#### Costvero

- AI-парсинг АВР;
- сверка с договором/сметой;
- накопительная ведомость;
- dashboard;
- pricing $299–999 заявлен как предварительный;
- on-premise.
- dashboard физического прогресса, customer read-only access, Telegram, CCTV и drone/orthophoto/3D options заявлены в текущем предложении.

Угроза: высокая для office-side АВР verification и растущая для связи физического прогресса с управленческой картиной. Пока публичное позиционирование не показывает тот же rule-guided before-concealment evidence → immutable period package loop, но граница быстро сужается.

Разделение:

- Costvero: «правильно ли составлен полученный АВР?»
- AktFlow: «есть ли всё, чтобы эту работу включить в пакет?»

Потенциально конкурент может стать интеграцией или приобрести field/evidence layer.

#### ScaneReport

- daily quantities;
- фото/видео;
- team/object;
- Excel export;
- PWA, offline browsing, push, custom permissions, audit log, TOTP 2FA;
- self-hosted/on-premise и прямой founder support.

Угроза: высокая для простого field report/capture MVP и средняя для AktFlow wedge: продукт уже закрывает скорость, объёмы, media, roles и audit, поэтому может добавить requirement/readiness слой. Публично он пока не показывает contract-line evidence rules, immutable package provenance и money-at-risk reconciliation. То, что его поддерживает solo developer, одновременно подтверждает реализуемость узкого продукта и низкий барьер появления новых конкурентов.

#### Roomskey

- project visibility;
- фото/видео;
- документы/чертежи;
- approvals.

Угроза: adjacent. Не строить client-facing renovation tracker.

#### Object Control

- trusted capture, GPS/time;
- offline;
- невозможность добавить/редактировать фото согласно policy;
- document generation/signing.

Угроза: потенциальный evidence engine. Заимствуем tamper-evident capture и политику source authenticity.

#### АВК/BAS/1C и Excel

Это главные substitutes, потому что уже оплачены и привычны. Стратегия — экспорт/импорт и отсутствие требования «заменить всё».

### 4.3 Итог свежего competitive pressure test

| Слой | Сильнейшее давление | Риск для AktFlow | Практический ответ |
|---|---|---:|---|
| Field capture/daily quantities | ScaneReport, Raken, CompanyCam, Object Control | высокий | не продавать фото/отчёт; тестировать rule-guided capture в бюджете 30–60 sec (жёсткий потолок 90 sec) и before-concealment timing |
| АВР/budget verification | Costvero, АВК/BAS/Excel | высокий | оставаться upstream: доказательства и readiness до получения готового АВР; file bridge first |
| Variations/revenue-at-risk | Clearstory | высокий в GA | Украина/CEE adapters, base-scope evidence и package readiness; не копировать generic change-order log |
| Billing/A/R | Siteline, BauApp PAP | высокий в GA | не входить в US lien/AIA; Pilot заканчивать на submission receipt, Project Commercials строить позже |
| Exact Ukrainian evidence-to-package loop | сочетание нескольких продуктов/substitutes | средний, но окно не доказано | подтвердить только на трёх реальных returned packages и paid pilot; отсутствие одного identical vendor не означает отсутствие конкуренции |

Текущий вывод: у AktFlow нет доказанного feature moat. Есть узкая интеграционная гипотеза — `contract line + timing rule + field evidence + deterministic readiness + immutable package` в одном subcontractor-owned record. Если customer artifacts не показывают ценность именно связки, продукт следует сузить до лучшего из двух validated jobs или остановить по kill criteria.

## 5. Государственная цифровизация как opportunity/threat

С 28 апреля 2026 года в ЄДЕССБ работает внесение цен строительной продукции по единым кодам на всех этапах; модернизированы сметная документация и сведения о выполнении работ, созданы цифровые документы, включая акт приёмки, а данные заявлены к ручной загрузке и обменным JSON/XLS/XLSX. Это означает:

- нельзя делать закрытый формат;
- нужен versioned adapter и canonical internal model;
- ценность AktFlow должна возникать до государственного акта;
- интеграция с ЄДЕССБ может стать сильным каналом, но нельзя обещать её до появления стабильного публичного API/формата;
- templates должны обновляться без release мобильного приложения.

## 6. Borrow / improve / avoid

| Capability | Borrow | Improve | Avoid |
|---|---|---|---|
| Field capture | Clearstory/Raken speed | Rule-guided capture before concealment | Длинные формы |
| External approval | Secure link without login | Clear legal label + expiry/OTP | Выдавать click за КЕП |
| Billing status | Siteline portfolio view | Ukrainian period/package model | US lien logic в core |
| Forms | Customer-specific templates | Versioned schema + ЄДЕССБ adapter | Hardcoded КБ forms |
| Change log | Clearstory live log | Link variation to base work/evidence | Generic issue tracker |
| Photos | CompanyCam organization | Hash, source, requirement link | Photo gallery as product |
| Settlement | BauApp snapshots | Evidence preflight before snapshot | GC-only ownership |
| Cost control | Costvero comparison | Field-to-line readiness | Rebuild АВК/ERP |
| AI | Extract/map/draft | Confidence + source + human approval | Autonomous financial edits |

## 7. Competitive moat plan

### Stage 1 — Workflow moat

- fastest field capture;
- best Ukrainian templates;
- concierge onboarding;
- readiness explainability.

### Stage 2 — Data moat

- requirement library by trade/customer/work type;
- rejection reason dataset;
- mapping aliases from real estimates;
- time-to-ready benchmarks.

### Stage 3 — Network/integration moat

- accepted package format with GCs;
- manufacturer/installer rule templates;
- ЄДЕССБ and accounting adapters;
- secure external review network.

### Stage 4 — Intelligence moat

- predict likely return/blocker;
- recommend capture before concealment;
- detect contradictory quantities/doc versions;
- benchmark GC payment/return behavior only with privacy-safe aggregates.

## 8. Positioning

### Primary

> AktFlow показывает, какие выполненные работы готовы к предъявлению, а какие деньги остаются под риском из-за отсутствующих доказательств или согласований.

### Не использовать

- «всё для стройки в одном месте»;
- «AI управляет строительством»;
- «гарантируем оплату»;
- «замена АВК/BAS»;
- «CRM для прораба».

## 9. Pricing anchors конкурентов

Публичные vendor anchors, перепроверенные 22.07.2026, показывают существование pricing $100–500+/month, но не доказывают украинскую willingness-to-pay:

- BauApp PAP: €249–399/month;
- Costvero: предварительно $299–999/month;
- Praevius: $99–449/month;
- PayProof: $29/package, $49–99/month;
- enterprise-лидеры используют quote-based pricing.

Украинский v1 должен продаваться не seat-based, а по active projects/financial throughput, поскольку field seats создают ценность и не должны искусственно ограничиваться.

## 10. Источники

- [Siteline](https://www.siteline.com/)
- [Clearstory](https://www.clearstory.build/)
- [BauApp PAP](https://pap.bauapp.com/)
- [Raken](https://www.rakenapp.com/)
- [Costvero](https://costvero.com/)
- [ScaneReport](https://scanereport.online/)
- [ScaneReport — about/security/self-hosted](https://scanereport.online/en/about)
- [Object Control](https://objectcontrol.online/)
- [Мінрозвитку — база цен, акты и JSON/XLS/XLSX, 14.05.2026](https://mindev.gov.ua/news/baza-danykh-tsin-na-budivelnu-produktsiiu-aktyvno-napovniuietsia-zvitamy-z-analizu-tsin)
- [Портал ЄДЕССБ — официальный материал](https://e-construction.gov.ua/ua/baza-danih-cin-na-budivelnu-produkciju-aktivno-napovnjuetsja-zvitami-z-analizu-cin)

Конкурентные claims являются данными их публичных сайтов и должны независимо проверяться перед использованием в маркетинге.
