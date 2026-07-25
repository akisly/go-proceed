import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderClock,
  LayoutDashboard,
  ListChecks,
  Menu,
  ScanLine,
  Settings,
  Split,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import Brand from './Brand'

const navGroups = [
  {
    label: 'Від роботи до доказу',
    items: [
      { href: '/app', label: 'Огляд', icon: LayoutDashboard, exact: true },
      { href: '/app/work', label: 'Роботи', icon: Boxes },
      { href: '/app/assignments', label: 'Завдання', icon: ClipboardList },
      { href: '/app/evidence', label: 'Перевірка', icon: ScanLine },
    ],
  },
  {
    label: 'Контроль і закриття',
    items: [
      { href: '/app/rules', label: 'Правила доказів', icon: ListChecks },
      { href: '/app/baseline', label: 'Умови й ревізії', icon: BookOpenCheck },
      { href: '/app/close', label: 'Закриття періоду', icon: FolderClock },
      { href: '/app/packages', label: 'Пакети АВР', icon: FileCheck2 },
      { href: '/app/payments', label: 'Проєктні оплати', icon: WalletCards },
    ],
  },
  {
    label: 'Керування',
    items: [
      { href: '/app/variations', label: 'Варіації', icon: Split },
      { href: '/app/team', label: 'Команда й доступ', icon: Users },
      { href: '/app/billing', label: 'Тариф AktFlow', icon: CreditCard },
      { href: '/app/settings', label: 'Налаштування', icon: Settings },
    ],
  },
]

const routeMeta = [
  {
    match: '/app/packages/current',
    section: 'Пакети АВР',
    file: 'PKG · AVR-2026-06 · v2',
    flow: 'Snapshot → перевірка → подання',
    detail: 'Точна версія, джерела рядків і рішення залишаються в одному досьє.',
    next: '/review/demo',
    nextLabel: 'Зовнішній перегляд',
  },
  {
    match: '/app/occurrences/demo',
    section: 'Завдання / EL-04.17',
    file: 'OCC · EL-04.17 · before-concealment',
    flow: 'Завдання → typed evidence → hold point',
    detail: 'Рішення про закриття доступне лише після валідного доказу й review.',
    next: '/field',
    nextLabel: 'Польова фіксація',
  },
  {
    match: '/app/assignments',
    section: 'Завдання',
    file: 'ASSIGNMENTS · HZN · 2026-07',
    flow: 'Робота → виконавець → occurrence',
    detail: 'Кожне завдання прив’язане до точної версії договору, правила й локації.',
    next: '/field',
    nextLabel: 'Відкрити польовий клієнт',
  },
  {
    match: '/app/evidence',
    section: 'Перевірка доказів',
    file: 'REVIEW QUEUE · HZN · LIVE',
    flow: 'Capture → review → readiness',
    detail: 'Оригінал, контекст, рішення та виправлення зберігаються окремими записами.',
    next: '/app/close',
    nextLabel: 'До закриття періоду',
  },
  {
    match: '/app/rules',
    section: 'Правила доказів',
    file: 'RULE PACK · ELECTRICAL · v2',
    flow: 'Чернетка → impact preview → publish',
    detail: 'Опублікована версія незмінна, історичні snapshots не перераховуються.',
    next: '/app/baseline',
    nextLabel: 'Умови й ревізії',
  },
  {
    match: '/app/baseline',
    section: 'Умови й ревізії',
    file: 'CONTRACT AUTHORITY · CTR-2026-02',
    flow: 'Умова → контрольована ревізія → призначення',
    detail: 'Договірні правила та посилання публікуються окремими незмінними версіями.',
    next: '/app/assignments',
    nextLabel: 'Перевірити завдання',
  },
  {
    match: '/app/close',
    section: 'Закриття періоду',
    file: 'CLOSE CYCLE · 2026-06 · #2',
    flow: 'Readiness → blockers → snapshot',
    detail: 'Жоден пакет не формується, доки hard blockers не усунуто або явно override.',
    next: '/app/packages/current',
    nextLabel: 'Поточний пакет',
  },
  {
    match: '/app/packages',
    section: 'Пакети АВР',
    file: 'PACKAGE REGISTER · HZN',
    flow: 'Snapshot → artifact → submission',
    detail: 'Кожний пакет має окрему версію, hash, manifest і журнал подання.',
    next: '/app/packages/current',
    nextLabel: 'Відкрити AVR-2026-06',
  },
  {
    match: '/app/payments',
    section: 'Проєктні оплати',
    file: 'RECEIVABLE LEDGER · HZN',
    flow: 'Acceptance → receivable → allocation',
    detail: 'Оплата будівельного проєкту не впливає на тариф або доступ AktFlow.',
  },
  {
    match: '/app/variations',
    section: 'Варіації',
    file: 'VARIATION REGISTER · HZN',
    flow: 'Notice → valuation → contract change',
    detail: 'Додаткова робота не стає договірною позицією без виданої точної версії.',
    next: '/app/baseline',
    nextLabel: 'Контроль договору',
  },
  {
    match: '/app/team',
    section: 'Команда й доступ',
    file: 'ACCESS DOSSIER · ENERGOPRO',
    flow: 'Identity → role → scope',
    detail: 'Доступ обмежується організацією, проєктом, локацією та роллю.',
    next: '/app/settings',
    nextLabel: 'Налаштування простору',
  },
  {
    match: '/app/billing',
    section: 'Тариф AktFlow',
    file: 'SAAS BILLING · ISOLATED PLANE',
    flow: 'Plan → invoice → entitlement',
    detail: 'SaaS-рахунки ізольовані від актів, дебіторки й оплат будівельного проєкту.',
  },
  {
    match: '/app/settings',
    section: 'Налаштування',
    file: 'WORKSPACE POLICY · ENERGOPRO',
    flow: 'Defaults → notifications → audit',
    detail: 'Обов’язкові security та billing події не можна вимкнути.',
  },
  {
    match: '/app/work',
    section: 'Роботи',
    file: 'WORK REGISTER · CTR-2026-02 · v3',
    flow: 'Кошторис → робота → завдання',
    detail: 'Кожен рядок зберігає джерело, план, виконання, готовність і блокер.',
    next: '/app/assignments',
    nextLabel: 'Перейти до завдань',
  },
  {
    match: '/app',
    section: 'Огляд',
    file: 'PROJECT DOSSIER · HZN-2026',
    flow: 'Виконано → готово → подано → оплачено',
    detail: 'Одна фінансова картина з поясненням до кожної гривні.',
    next: '/app/work',
    nextLabel: 'Відкрити роботи',
  },
]

export default function AppShell({ title, eyebrow, action, children }) {
  const [open, setOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const meta = routeMeta.find(item => pathname === item.match || (item.match !== '/app' && pathname.startsWith(item.match))) || routeMeta.at(-1)

  const closeNavigation = () => {
    setOpen(false)
    setProjectOpen(false)
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">До основного вмісту</a>
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__top">
          <Brand light />
          <button className="icon-button sidebar__close" onClick={() => setOpen(false)} aria-label="Закрити меню"><X size={19} /></button>
        </div>

        <div className="org-switcher">
          <button className="org-switch" onClick={() => setProjectOpen(value => !value)} aria-expanded={projectOpen} aria-controls="project-menu">
            <span className="org-switch__avatar">ЕП</span>
            <span><b>ЕнергоПро Монтаж</b><small>БЦ Horizon · активний</small></span>
            <ChevronDown size={15} />
          </button>
          {projectOpen && <div className="org-menu" id="project-menu">
            <small>РОБОЧИЙ КОНТЕКСТ</small>
            <button onClick={() => { navigate('/app'); closeNavigation() }}><CheckCircle2 size={15}/><span><b>БЦ Horizon</b><small>Червень 2026 · активний</small></span></button>
            <button disabled><span className="org-menu__dot"/><span><b>Logistics West</b><small>Поза межами демо</small></span></button>
            <Link to="/app/settings" onClick={closeNavigation}>Керувати простором <ArrowRight size={14}/></Link>
          </div>}
        </div>

        {navGroups.map(group => <div className="sidebar__group" key={group.label}>
          <div className="sidebar__section-label">{group.label}</div>
          <nav className="sidebar__nav" aria-label={group.label}>
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(href) || (href === '/app/assignments' && pathname.startsWith('/app/occurrences'))
              return <Link key={href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} to={href} onClick={closeNavigation}><Icon size={18} /><span>{label}</span></Link>
            })}
          </nav>
        </div>)}

        <div className="sidebar__bottom">
          <div className="sync-ok"><span /> Синхронізація в нормі</div>
          <a href="mailto:hello@aktflow.example?subject=AktFlow%20support"><CircleHelp size={18} /> Допомога</a>
          <div className="user-chip"><span>ІК</span><div><b>Ірина Коваленко</b><small>Керівниця ВТВ</small></div></div>
        </div>
      </aside>

      <main className="app-main" id="main-content" tabIndex="-1">
        <header className="app-header">
          <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Відкрити меню"><Menu size={22} /></button>
          <div className="app-header__title">
            <nav className="breadcrumbs" aria-label="Шлях сторінки">
              <Link to="/app">БЦ Horizon</Link><ChevronRight size={12}/><span>{meta.section}</span>
            </nav>
            {eyebrow && <span>{eyebrow}</span>}
            <h1>{title}</h1>
          </div>
          <div className="app-header__actions">
            <div className="notification-anchor">
              <button className="icon-button" onClick={() => setNotificationsOpen(value => !value)} aria-expanded={notificationsOpen} aria-label="Сповіщення"><Bell size={19} /><i /></button>
              {notificationsOpen && <aside className="notification-popover" aria-label="Останні сповіщення">
                <header><b>Сповіщення</b><span>2 нові</span></header>
                <Link to="/app/evidence" onClick={() => setNotificationsOpen(false)}><span className="notification-popover__signal"/><div><b>3 докази очікують review</b><small>Найстаріший · 19 хв</small></div></Link>
                <Link to="/app/close" onClick={() => setNotificationsOpen(false)}><span className="notification-popover__risk">!</span><div><b>2 блокери закриття</b><small>Під ризиком 482 400 ₴</small></div></Link>
                <Link to="/app/settings" onClick={() => setNotificationsOpen(false)}>Налаштувати сповіщення <ArrowRight size={14}/></Link>
              </aside>}
            </div>
            {action}
          </div>
        </header>

        <section className="route-context" aria-label="Контекст потоку">
          <span className="route-context__file">{meta.file}</span>
          <div><b>{meta.flow}</b><span>{meta.detail}</span></div>
          {meta.next && <Link to={meta.next}>{meta.nextLabel}<ArrowRight size={15}/></Link>}
        </section>
        {children}
      </main>
      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Закрити меню" />}
    </div>
  )
}
