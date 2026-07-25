import { useState } from 'react'
import { ArrowLeft, Camera, Check, ChevronRight, CloudOff, ImagePlus, MapPin, RotateCcw, Send, Wifi, X } from 'lucide-react'
import Brand from '../components/Brand'

const tasks = [
  { urgent: true, code: 'EL-04.17', name: 'Прокладання кабелю ВВГнг 5×16', location: 'Секція B · 4 поверх', meta: 'До закриття стелі · сьогодні 17:00' },
  { code: 'EL-09.05', name: 'Аварійні світильники', location: 'Паркінг · P2', meta: '2 докази · 36 шт.' },
  { code: 'EL-14.01', name: 'Вимірювання опору ізоляції', location: 'Секція B · стояк', meta: 'Протокол + обсяг' },
]

export default function Field() {
  const [screen, setScreen] = useState(0)
  const [activeTab, setActiveTab] = useState('today')
  const [photos, setPhotos] = useState(0)
  const [qty, setQty] = useState('48')
  const [synced, setSynced] = useState(false)

  const resetToTasks = () => {
    setScreen(0)
    setActiveTab('today')
    setPhotos(0)
    setSynced(false)
  }

  if (screen === 1) return <div className="field-phone">
    <header className="field-header">
      <button onClick={() => setScreen(0)} aria-label="Назад до завдань"><ArrowLeft/></button>
      <div><small>EL-04.17</small><b>Фіксація роботи</b></div>
      <span className="offline-chip"><CloudOff size={13}/> Офлайн</span>
    </header>
    <main className="capture-screen">
      <div className="capture-context"><span><MapPin size={16}/>Секція B · 4 поверх</span><h1>Прокладання кабелю ВВГнг 5×16</h1></div>
      <section className="capture-block">
        <div className="capture-block__title"><span>1</span><div><b>Фото до закриття</b><small>{photos} з 2 обов’язкових</small></div></div>
        <button className={`camera-zone ${photos >= 2 ? 'complete' : ''}`} onClick={() => setPhotos(Math.min(2, photos + 1))}>
          {photos >= 2
            ? <><img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Додані фото кабельної траси"/><span className="camera-zone__receipt"><Check size={18}/><b>2 фото додано</b><small>Торкніться, щоб переглянути</small></span></>
            : <><Camera size={36}/><b>Зробити фото {photos + 1}</b><span>Покажіть трасу та кріплення</span>{photos === 1 && <small className="camera-zone__count">Фото 01 збережено локально</small>}</>}
        </button>
      </section>
      <section className="capture-block">
        <div className="capture-block__title"><span>2</span><div><b>Виконаний обсяг</b><small>Залишок за завданням: 126 м</small></div></div>
        <label className="quantity-input"><input value={qty} onChange={event => setQty(event.target.value)} inputMode="decimal" aria-label="Виконаний обсяг"/><span>м</span></label>
      </section>
    </main>
    <footer className="field-footer"><button className="button button--signal button--full" disabled={photos < 2 || !qty} onClick={() => setScreen(2)}>Перевірити й зберегти <ChevronRight size={18}/></button><small><CloudOff size={13}/> Збережемо на цьому пристрої</small></footer>
  </div>

  if (screen === 2) return <div className="field-phone field-success">
    <header className="field-header">
      <button onClick={() => setScreen(1)} aria-label="Назад до фіксації"><ArrowLeft/></button>
      <div><small>EL-04.17</small><b>Готово</b></div>
      <button onClick={resetToTasks} aria-label="Закрити receipt"><X/></button>
    </header>
    <main>
      <img className="field-receipt-stamp" src="/assets/evidence-atlas/verified-stamp.png" alt="" />
      <div className={`success-mark ${synced ? 'synced' : ''}`}><Check size={42}/></div>
      <h1>{synced ? 'Підтверджено сервером' : 'Збережено на пристрої'}</h1>
      <p>{synced ? 'Докази отримав AktFlow. ВТВ уже бачить роботу в черзі перевірки.' : 'Можна закривати застосунок. AktFlow надішле 2 фото та 48 м, щойно з’явиться мережа.'}</p>
      <div className="local-receipt"><span>{synced ? <Wifi size={20}/> : <CloudOff size={20}/>}</span><div><small>{synced ? 'СЕРВЕРНИЙ ЧЕК' : 'ЛОКАЛЬНИЙ ЧЕК'}</small><b>AF-7B42 · 18:42</b></div><strong>{synced ? 'Надіслано' : 'У черзі'}</strong></div>
      <div className="success-summary"><p><span>Робота</span><b>EL-04.17</b></p><p><span>Обсяг</span><b>48 м</b></p><p><span>Докази</span><b>2 фото</b></p><p><span>Локація</span><b>4 поверх</b></p></div>
      {!synced
        ? <button className="button button--dark button--full" onClick={() => setSynced(true)}><Send size={17}/> Симулювати появу мережі</button>
        : <button className="button button--signal button--full" onClick={resetToTasks}>До завдань</button>}
    </main>
  </div>

  return <div className="field-phone">
    <header className="field-home-header"><Brand/><span className="offline-chip"><CloudOff size={13}/> Офлайн</span></header>
    <main className="field-home">
      <div className="field-greeting"><span>Вівторок, 22 липня</span><h1>{activeTab === 'today' ? 'Добрий день, Сергію' : activeTab === 'captures' ? 'Ваші фіксації' : 'Черга синхронізації'}</h1><p><MapPin size={15}/> БЦ Horizon · Секція B</p></div>

      {activeTab === 'today' && <>
        <div className="today-head"><h2>На сьогодні</h2><b>3</b></div>
        <div className="task-list">{tasks.map((task, index) => <button key={task.code} className={task.urgent ? 'urgent' : ''} onClick={() => setScreen(1)}>
          {task.urgent && <span className="urgent-label">До закриття</span>}
          {index === 0 && <img className="task-evidence-thumb" src="/assets/evidence-atlas/cable-tray-evidence.png" alt="" />}
          <div className="task-top"><small>{task.code}</small><ChevronRight size={18}/></div>
          <h3>{task.name}</h3>
          <p><MapPin size={14}/>{task.location}</p>
          <div className="task-bottom"><span>{task.meta}</span><i>{index === 0 ? <Camera size={16}/> : <ImagePlus size={16}/>}</i></div>
        </button>)}</div>
        <button className="draft-row" onClick={() => setActiveTab('queue')}><RotateCcw size={17}/><span><b>1 чернетка</b><small>Збережена на пристрої</small></span><ChevronRight size={17}/></button>
      </>}

      {activeTab === 'captures' && <section className="field-register">
        <span>ОСТАННІ 7 ДНІВ</span>
        <button onClick={() => setScreen(2)}><img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Кабельна траса"/><div><small>CAP-739 · сьогодні, 16:08</small><b>Аварійні світильники</b><em><Check size={13}/> Серверний чек</em></div><ChevronRight size={18}/></button>
        <button onClick={() => setScreen(2)}><img src="/assets/evidence-atlas/cable-tray-evidence.png" alt="Кріплення кабельної траси"/><div><small>CAP-721 · учора, 14:32</small><b>Кабельні лотки 200 мм</b><em><Check size={13}/> Схвалено ВТВ</em></div><ChevronRight size={18}/></button>
      </section>}

      {activeTab === 'queue' && <section className="field-queue">
        <CloudOff size={28}/>
        <h2>1 запис очікує мережу</h2>
        <p>Оригінали й обсяг збережені на цьому пристрої. Авторизаційна lease ще чинна.</p>
        <button className="field-queue__item" onClick={() => setScreen(2)}><span>AF-7B42</span><div><b>EL-04.17 · 2 фото · 48 м</b><small>Локальний чек · 18:42</small></div><ChevronRight size={18}/></button>
        <div className="field-queue__item field-queue__item--quarantine" role="status">
          <span>AF-7A19</span>
          <div>
            <b>EL-09.05 · 1 фото · У карантині — авторизацію інвалідовано</b>
            <small>Фіксацію зроблено після відкликання lease. Оригінал збережено; у пакет і review не потрапить. Рішення Security Admin: відновити або відхилити.</small>
          </div>
        </div>
      </section>}
    </main>
    <nav className="field-nav" aria-label="Мобільна навігація">
      <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}><Check size={20}/><span>Сьогодні</span></button>
      <button className={activeTab === 'captures' ? 'active' : ''} onClick={() => setActiveTab('captures')}><Camera size={20}/><span>Фіксації</span></button>
      <button className={activeTab === 'queue' ? 'active' : ''} onClick={() => setActiveTab('queue')}><CloudOff size={20}/><span>Черга</span><i>1</i></button>
    </nav>
  </div>
}
