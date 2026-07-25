import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Brand from '../components/Brand'

const documents = {
  privacy: {
    eyebrow: 'PRIVACY NOTICE · DEMO v2026-07',
    title: 'Повідомлення про приватність',
    intro: 'Цей інтерактивний прототип використовує лише синтетичні дані та не надсилає введені значення на production backend.',
    sections: [
      ['Що показує прототип', 'Приклади компаній, людей, сум, доказів і документів створені для демонстрації продуктового потоку. Вони не належать реальним клієнтам.'],
      ['Що передбачено для production', 'Tenant isolation, рольовий доступ, retention policy, export-first closure, журнал підтримки та окрема оцінка зовнішніх провайдерів.'],
      ['Запити', 'Власник організації матиме контрольований export та процедуру закриття. Юридичні строки й підстави будуть підтверджені до GA.'],
    ],
  },
  terms: {
    eyebrow: 'PRODUCT TERMS · DEMO v2026-07',
    title: 'Умови демонстраційного використання',
    intro: 'AktFlow у цьому пакеті є локальним інтерактивним прототипом і не створює юридичного погодження, підпису, рахунку або платежу.',
    sections: [
      ['Рішення в демо', 'Review receipts, operational acceptance та package submission демонструють UX-контракт. Вони не є КЕП і не змінюють реальні договори.'],
      ['Польова фіксація', 'Фото, offline receipt і server receipt симулюються локальним станом. Production вимагатиме серверної lease, перевірки доступу та sealed originals.'],
      ['Тарифи', 'Ціни на landing — продуктова гіпотеза для пілоту. Комерційна пропозиція, податки й seller-document model затверджуються окремо.'],
    ],
  },
}

export default function Legal() {
  const { document = 'privacy' } = useParams()
  const content = documents[document] || documents.privacy
  return <div className="legal-page">
    <header><Brand/><Link to="/"><ArrowLeft size={16}/> На головну</Link></header>
    <main>
      <aside><FileText size={28}/><span>{content.eyebrow}</span><p>Демонстраційний документ · не production policy</p></aside>
      <article><span className="legal-page__shield"><ShieldCheck size={21}/></span><h1>{content.title}</h1><p className="legal-page__intro">{content.intro}</p>{content.sections.map(([title, body], index) => <section key={title}><small>0{index + 1}</small><div><h2>{title}</h2><p>{body}</p></div></section>)}<a href="mailto:hello@aktflow.example">hello@aktflow.example</a></article>
    </main>
  </div>
}
