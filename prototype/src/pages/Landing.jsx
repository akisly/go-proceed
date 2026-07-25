import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, Check, ChevronRight, CloudOff, MapPin, Menu, RefreshCw, ShieldCheck, Smartphone, X, Zap } from 'lucide-react'
import Brand from '../components/Brand'
import FinancialRail from '../components/FinancialRail'

const steps = [
  ['01', 'Імпортуйте кошторис', 'AktFlow збереже структуру, кількість, ціну й версію договору. Без ручного перенесення рядків.'],
  ['02', 'Зберіть докази на об’єкті', 'Майстер бачить лише потрібні роботи та фіксує фото, обсяг і місце навіть без мережі.'],
  ['03', 'Приберіть блокери завчасно', 'ВТВ отримує чергу перевірки та бачить суму, яку блокує кожна відсутня вимога.'],
  ['04', 'Подайте повний пакет', 'Версійний реєстр робіт і доказів переходить у пакет та контроль прийняття й оплати.'],
]

const plans = [
  { name: 'Start', price: '4 900', projects: '1 активний об’єкт', features: ['5 офісних користувачів', 'Польова команда без доплати', '50 ГБ доказів', 'Базові пакети АВР'] },
  { name: 'Control', price: '10 900', projects: '3 активні об’єкти', popular: true, features: ['15 офісних користувачів', 'Варіації та зовнішнє погодження', '200 ГБ доказів', 'Розширені звіти'] },
  { name: 'Portfolio', price: 'від 22 000', projects: '8+ активних об’єктів', features: ['API та webhooks', 'Власні шаблони', 'SSO за запитом', 'Пріоритетний супровід'] },
]

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const [role, setRole] = useState('Власнику')
  const navigate = useNavigate()
  return <div className="landing">
    <header className="site-header">
      <Brand />
      <nav className={menu ? 'open' : ''}>
        <a href="#product" onClick={() => setMenu(false)}>Продукт</a>
        <a href="#workflow" onClick={() => setMenu(false)}>Як працює</a>
        <a href="#mobile" onClick={() => setMenu(false)}>Мобільний</a>
        <a href="#roles" onClick={() => setMenu(false)}>Для кого</a>
        <a href="#security" onClick={() => setMenu(false)}>Безпека</a>
        <a href="#pricing" onClick={() => setMenu(false)}>Тарифи</a>
      </nav>
      <div className="site-header__actions">
        <Link className="link-button" to="/login">Увійти</Link>
        <Link className="button button--dark button--small" to="/pilot">Запустити пілот <ArrowRight size={16} /></Link>
      </div>
      <button className="site-menu" onClick={() => setMenu(!menu)} aria-label="Меню">{menu ? <X /> : <Menu />}</button>
    </header>

    <main>
      <section className="hero" id="product">
        <div className="hero__copy">
          <h1>Виконані роботи мають ставати оплатою.</h1>
          <p>AktFlow пов’язує кожну позицію кошторису з доказами, погодженнями та документами — ще до подання АВР.</p>
          <div className="hero__actions">
            <Link className="button button--signal" to="/pilot">Запустити пілот <ArrowRight size={18} /></Link>
            <Link className="button button--outline" to="/app">Переглянути демо</Link>
          </div>
          <div className="hero__proof"><span><Check size={15} /> 45 днів пілоту</span><span><Check size={15} /> 1 живий об’єкт</span><span><Check size={15} /> Без заміни обліку</span></div>
        </div>
        <div className="hero-atlas">
          <img className="hero-atlas__blueprint" src="/assets/evidence-atlas/blueprint-folio.png" alt="" />
          <div className="hero-product" aria-label="Демонстрація фінансової готовності">
            <div className="hero-product__top"><div><small>Об’єкт</small><b>БЦ Horizon</b></div><span>Червень 2026</span></div>
            <div className="hero-product__money"><div><small>Готово до подання</small><strong>2 650 000 ₴</strong><em>78% виконаних робіт</em></div><div className="risk-orb"><small>Під ризиком</small><b>750 000 ₴</b></div></div>
            <div className="evidence-flow">
              <div className="flow-card flow-card--done"><span><Check size={16} /></span><div><small>EL-03.21</small><b>Гофротруба Ø25</b></div><em>172 000 ₴</em></div>
              <div className="flow-line"><i /><i /><i /></div>
              <div className="flow-card flow-card--risk"><span>!</span><div><small>EL-04.17 · 4 поверх</small><b>Потрібні фото до закриття</b></div><em>204 400 ₴</em></div>
            </div>
            <FinancialRail compact />
            <div className="hero-evidence-stack" aria-label="Пов’язані докази">
              <figure><img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Кабельна траса на об’єкті" /><figcaption><b>Фото 01</b><span>CAP-742 · оригінал</span></figcaption></figure>
              <figure className="hero-evidence-stack__sheet"><span>PDF</span><figcaption><b>Акт прихованих робіт</b><span>DOC-184 · v2</span></figcaption></figure>
            </div>
          </div>
          <img className="hero-atlas__stamp" src="/assets/evidence-atlas/verified-stamp.png" alt="Evidence sealed" />
        </div>
      </section>

      <section className="numbers-band">
        <div><strong>3,4 млн ₴</strong><span>виконано за період</span></div>
        <i />
        <div><strong>2,65 млн ₴</strong><span>готово до подання</span></div>
        <i />
        <div className="numbers-band__risk"><strong>750 000 ₴</strong><span>ще можна захистити</span></div>
      </section>

      <section className="workflow" id="workflow">
        <div className="section-heading"><h2>Від кошторису — до грошей.<br />Один доказовий ланцюг.</h2><p>Не будуйте ще один паралельний облік. AktFlow додає контроль там, де між майданчиком, ВТВ і бухгалтерією губиться готовність до подання.</p></div>
        <div className="workflow__list">
          {steps.map(([num, title, body], index) => <article key={num} className={index === 1 ? 'is-highlighted' : ''}><span>{num}</span><div><h3>{title}</h3><p>{body}</p></div><ChevronRight size={22} /></article>)}
        </div>
      </section>

      <section className="mobile-section" id="mobile">
        <div className="mobile-section__copy">
          <span className="mobile-section__icon"><Smartphone size={23} /></span>
          <h2>Майданчик працює<br />в мобільному застосунку.</h2>
          <p>Польовий клієнт для iOS та Android — ядро Pilot, а не додатковий модуль. Майстер отримує точне завдання, фіксує доказ і обсяг на місці, а ВТВ бачить серверний чек після синхронізації.</p>
          <div className="mobile-benefits">
            <article><CloudOff size={20} /><div><b>Офлайн за замовчуванням</b><span>Чернетки, фото й обсяги залишаються на пристрої до підтвердженої синхронізації.</span></div></article>
            <article><Camera size={20} /><div><b>Контекст уже в завданні</b><span>Робота, локація, вимога, кількість і потрібні ракурси — без чатів та пошуку файлів.</span></div></article>
            <article><RefreshCw size={20} /><div><b>Два перевірювані чеки</b><span>Локальний receipt захищає від втрати, серверний — від дублювання доказу та обсягу.</span></div></article>
          </div>
          <div className="mobile-section__actions">
            <Link className="button button--signal" to="/field">Відкрити мобільне демо <ArrowRight size={18} /></Link>
            <span>iOS + Android · у межах Pilot</span>
          </div>
        </div>

        <div className="mobile-stage" aria-hidden="true">
          <div className="landing-phone">
            <div className="landing-phone__speaker" />
            <header><Brand /><span><CloudOff size={12} /> Офлайн</span></header>
            <main>
              <div className="landing-phone__greeting"><small>ВІВТОРОК, 22 ЛИПНЯ</small><h3>Добрий день, Сергію</h3><p><MapPin size={13} /> БЦ Horizon · Секція B</p></div>
              <div className="landing-phone__today"><b>На сьогодні</b><span>3</span></div>
              <article className="landing-phone__task landing-phone__task--active">
                <div><small>EL-04.17</small><em>До закриття</em></div>
                <h4>Прокладання кабелю ВВГнг 5×16</h4>
                <p><MapPin size={12} /> Секція B · 4 поверх</p>
                <img className="landing-phone__evidence" src="/assets/evidence-atlas/cable-tray-evidence.png" alt="" />
                <footer><span>2 фото + виконаний обсяг</span><Camera size={17} /></footer>
              </article>
              <article className="landing-phone__task"><div><small>EL-09.05</small></div><h4>Аварійні світильники</h4><p><MapPin size={12} /> Паркінг · P2</p></article>
            </main>
            <nav><span className="active"><Check size={17} />Сьогодні</span><span><Camera size={17} />Фіксації</span><span><CloudOff size={17} />Черга</span></nav>
          </div>
          <div className="mobile-receipt"><span><Check size={18} /></span><div><small>СЕРВЕРНИЙ ЧЕК</small><b>2 фото · 48 м</b><p>Синхронізовано без дублювання</p></div></div>
        </div>
      </section>

      <section className="role-section" id="roles">
        <div className="role-section__header"><h2>Одна правда для кожної ролі.</h2><div className="role-tabs">{['Власнику','ВТВ','Виконробу','Бухгалтерії'].map((name) => <button key={name} onClick={() => setRole(name)} className={role === name ? 'active' : ''}>{name}</button>)}</div></div>
        <div className="role-stage">
          <div className="role-stage__copy"><span className="big-index">0{['Власнику','ВТВ','Виконробу','Бухгалтерії'].indexOf(role)+1}</span><h3>{role === 'Власнику' ? 'Бачити гроші раніше, ніж проблему.' : role === 'ВТВ' ? 'Закривати період без полювання за файлами.' : role === 'Виконробу' ? 'Здати доказ за хвилину — навіть офлайн.' : 'Отримати готовий реєстр і відстежити оплату.'}</h3><p>{role === 'Власнику' ? 'Виконано, готово, під ризиком і прострочено — з поясненням до кожної гривні.' : 'Кожна роль отримує лише потрібний контекст, а система зберігає єдиний ланцюг від роботи до платежу.'}</p><Link to="/app">Відкрити рольове демо <ArrowRight size={17} /></Link></div>
          <div className="role-stage__visual"><div className="mini-dashboard"><div className="mini-sidebar"><span /><span /><span className="active" /><span /><span /></div><div className="mini-canvas"><small>ГОТОВНІСТЬ ДО ОПЛАТИ</small><strong>2 650 000 ₴</strong><div className="mini-bars"><i style={{width:'92%'}}/><i style={{width:'72%'}}/><i style={{width:'48%'}}/></div><div className="mini-list"><span/><span/><span/></div></div><div className="mini-note"><Zap size={16} /> 3 дії захищають<br/><b>482 400 ₴</b></div></div></div>
        </div>
      </section>

      <section className="security-section" id="security">
        <div><ShieldCheck size={42} /><h2>Ваш доказовий архів залишається вашим.</h2></div>
        <div className="security-points"><p><b>Розмежування доступу</b><br/>Організація, об’єкт, локація та роль перевіряються на кожній дії.</p><p><b>Версії без переписування</b><br/>Поданий пакет і оригінал доказу не зникають після виправлення.</p><p><b>Експорт без пастки</b><br/>CSV/JSON, оригінали, пакети та manifest доступні власнику.</p></div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading"><h2>Тариф за контроль об’єктів,<br/>не за кожного майстра.</h2><p>Польова команда має фіксувати більше, а не думати про ліцензії. Ціни — стартова гіпотеза для пілоту.</p></div>
        <div className="pricing-grid">{plans.map((plan) => <article key={plan.name} className={plan.popular ? 'popular' : ''}>{plan.popular && <span className="plan-label">Рекомендований</span>}<h3>{plan.name}</h3><div className="price"><strong>{plan.price}</strong><span>₴ / міс.</span></div><b>{plan.projects}</b><ul>{plan.features.map((f) => <li key={f}><Check size={16}/>{f}</li>)}</ul><button onClick={() => navigate('/pilot')} className={`button ${plan.popular ? 'button--signal' : 'button--outline'}`}>Обрати {plan.name}</button></article>)}</div>
      </section>

      <section className="final-cta"><div><h2>Почніть з одного реального періоду.</h2><p>Порівняємо останнє закриття, налаштуємо один об’єкт і за 45 днів побачимо, чи AktFlow прибирає ваші реальні блокери.</p></div><Link className="button button--signal" to="/pilot">Запустити пілот <ArrowRight size={18}/></Link></section>
    </main>
    <footer><Brand light/><p>Evidence-to-payment для спеціалізованих підрядників.</p><div><Link to="/legal/privacy">Конфіденційність</Link><Link to="/legal/terms">Умови</Link><a href="mailto:hello@aktflow.example">hello@aktflow.example</a></div></footer>
  </div>
}
