import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Brand from '../components/Brand'

const fields = [
  ['Код позиції', ['Шифр / Код', 'Позиція', 'Column A'], 'EL-04.17'],
  ['Опис роботи', ['Найменування робіт', 'Опис', 'Column B'], 'Прокладання кабелю ВВГнг 5×16'],
  ['Одиниця', ['Од. вим.', 'Одиниця', 'Column C'], 'м'],
  ['Кількість', ['Кількість', 'Обсяг', 'Column D'], '1 240,00'],
  ['Ціна за одиницю', ['Ціна', 'Ціна од.', 'Column E'], '430,00'],
]

const sheets = ['Кошторис', 'Розділ 2', 'Підсумки']

export default function Onboarding() {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(() => {
    const requested = Number(searchParams.get('step'))
    return requested >= 1 && requested <= 5 ? requested : 3
  })
  const [uploaded, setUploaded] = useState(true)
  const [imported, setImported] = useState(false)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [columnChoice, setColumnChoice] = useState({})
  const navigate = useNavigate()
  const cycleColumn = target => setColumnChoice(current => ({ ...current, [target]: ((current[target] ?? 0) + 1) % 3 }))
  const next = () => {
    if (step === 4) navigate('/app/rules?setup=1')
    else if (step < 5) setStep(step + 1)
    else navigate('/app')
  }
  const back = () => step > 1 && setStep(step - 1)
  return <div className="onboarding">
    <aside className="onboarding__aside"><Brand light/><div className="onboarding__steps">{['Компанія','Перший об’єкт','Імпорт кошторису','Правила доказів','Команда'].map((name, i) => <div key={name} className={`${step === i+1 ? 'active' : ''} ${step > i+1 ? 'done' : ''}`}><span>{step > i+1 ? <Check size={14}/> : i+1}</span><p><small>Крок {i+1}</small><b>{name}</b></p></div>)}</div><div className="aside-help"><p>Потрібна допомога з файлом?</p><a href="mailto:hello@aktflow.example">Написати нам</a></div></aside>
    <main className="onboarding__main">
      <header><button onClick={back} className="icon-button" aria-label="Назад"><ArrowLeft size={20}/></button><div><span>Крок {step} з 5</span><i><b style={{width:`${step*20}%`}}/></i></div><button className="quiet-button" onClick={() => navigate('/app')}>Зберегти й вийти</button></header>
      {step === 3 ? <div className="onboarding-content import-step">
        <div className="onboarding-title"><h1>Імпортуйте кошторис</h1><p>Зіставте колонки один раз. AktFlow збереже налаштування для наступних версій.</p></div>
        {!uploaded ? <button className="upload-zone" onClick={() => setUploaded(true)}><Upload size={32}/><b>Перетягніть XLSX, XLS або CSV</b><span>або натисніть, щоб обрати файл · до 25 МБ</span></button> : <div className="file-card"><span><FileSpreadsheet size={23}/></span><div><b>Кошторис_Horizon_електрика_v4.xlsx</b><small>428 позицій · 184 КБ · Завантажено щойно</small></div><button onClick={() => setUploaded(false)} aria-label="Видалити файл"><X size={18}/></button></div>}
        <div className="mapping-head"><div><h2>Зіставлення колонок</h2><p>Аркуш: <button onClick={() => setSheetIndex((sheetIndex + 1) % sheets.length)} aria-label={`Аркуш: ${sheets[sheetIndex]}. Натисніть, щоб обрати наступний`}>{sheets[sheetIndex]} <ChevronDown size={14}/></button> · Заголовок: рядок 7</p></div><span>5 з 5 обов’язкових полів</span></div>
        <div className="mapping-table"><div className="mapping-table__head"><span>Поле AktFlow</span><span>Колонка у файлі</span><span>Приклад</span></div>{fields.map(([target, sources, example]) => <div className="mapping-row" key={target}><b>{target}<small>Обов’язково</small></b><button onClick={() => cycleColumn(target)} aria-label={`Колонка для поля ${target}: ${sources[columnChoice[target] ?? 0]}. Натисніть, щоб обрати наступну`}>{sources[columnChoice[target] ?? 0]}<ChevronDown size={15}/></button><span>{example}</span></div>)}</div>
        <div className="validation-strip"><div className="valid"><strong>428</strong><span>готові до імпорту</span></div><div className="warn"><strong>11</strong><span>потрібно перевірити</span></div><div><strong>0</strong><span>дублікатів</span></div><button onClick={() => setImported(true)}>Переглянути 11 рядків <ArrowRight size={15}/></button></div>
        {imported && <div className="import-success"><Check size={18}/><div><b>Перевірка завершена</b><span>428 позицій готові. 11 попереджень не блокують імпорт.</span></div></div>}
      </div> : <GenericStep step={step}/>} 
      <footer className="onboarding-footer"><button className="button button--outline" onClick={back}>Назад</button><button className="button button--dark" onClick={next}>{step === 3 ? 'Імпортувати 428 позицій' : step === 4 ? 'Налаштувати правила' : step === 5 ? 'Відкрити AktFlow' : 'Продовжити'} <ArrowRight size={17}/></button></footer>
    </main>
  </div>
}

function GenericStep({ step }) {
  const content = {
    1: ['Створіть робочий простір','Назва компанії, валюта та часовий пояс стануть основою організації.'],
    2: ['Додайте перший об’єкт','Вкажіть договір, замовника, період закриття та базові комерційні умови.'],
    4: ['Оберіть правила доказів','Почніть з пакета електромонтажних робіт і змініть вимоги під свій договір.'],
    5: ['Запросіть команду','Додайте ВТВ, керівника проєкту, виконроба та бухгалтерію з потрібним доступом.'],
  }[step]
  return <div className="onboarding-content generic-step"><div className="onboarding-title"><h1>{content[0]}</h1><p>{content[1]}</p></div><div className="generic-form"><label>{step === 1 ? 'Назва компанії' : step === 2 ? 'Назва об’єкта' : step === 4 ? 'Пакет правил' : 'Робочі email'}<input defaultValue={step === 1 ? 'ЕнергоПро Монтаж' : step === 2 ? 'БЦ Horizon' : step === 4 ? 'Електромонтаж · комерційна нерухомість' : 'serhii@energopro.ua'}/></label><label>{step === 1 ? 'Базова валюта' : step === 2 ? 'Замовник' : step === 4 ? 'Контроль до закриття' : 'Роль'}<select defaultValue="default"><option value="default">{step === 1 ? 'UAH — гривня' : step === 2 ? 'Horizon Development' : step === 4 ? 'Фото + обсяг + місце' : 'Виконроб'}</option></select></label></div></div>
}
