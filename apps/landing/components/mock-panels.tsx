import Image from "next/image";
import { Chip, Panel, Table, Td, Th, Tr } from "@goproceed/ui/components";

export function RequirementPanel() {
  return (
    <MockFrame index="REQ · R-041" title="Кабельний лоток до закриття стелі" status={<Chip tone="attention">Блокуюча</Chip>}>
      <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-5">
          <MockField label="Робота" value="Монтаж кабельних трас · ВРУ-1" />
          <MockField label="Момент" value="До закриття підвісної стелі" />
          <MockField label="Підстава" value="ДБН А.3.1-5:2016 · п. 8.4" />
        </div>
        <div className="rounded-panel border border-line bg-subtle p-4">
          <p className="index-label text-ink-muted">Потрібно отримати</p>
          <ul className="mt-4 space-y-3 text-data text-ink">
            {[
              "Загальний вигляд траси",
              "Вузол кріплення",
              "Маркування лінії",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 rounded-pill bg-action-signal" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MockFrame>
  );
}

export function CapturePanel() {
  return (
    <MockFrame index="CAPTURE · EV-0248" title="Фіксація на майданчику" status={<Chip tone="review">На розгляді</Chip>}>
      <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <figure className="relative min-h-64 overflow-hidden rounded-panel border border-line bg-sunken">
          <Image
            src="/images/cable-tray-evidence.png"
            alt="Фото кабельного лотка у записі польового доказу"
            fill
            sizes="(max-width: 768px) 90vw, 480px"
            className="object-cover"
          />
          <figcaption className="absolute inset-x-3 bottom-3 rounded-control bg-inverse px-3 py-2 text-meta text-on-inverse">
            Камера · 20.08.2026 · 14:32
          </figcaption>
        </figure>
        <div className="space-y-4">
          <MockField label="Місце" value="ВРУ-1 · Секція А" />
          <MockField label="Автор" value="Майстер дільниці" />
          <MockField label="Походження" value="Польова вебпрограма" />
          <div className="border-t border-line pt-4">
            <p className="text-meta leading-relaxed text-ink-muted">
              Доказ уже пов’язаний з R-041. Повторно обирати роботу не потрібно.
            </p>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

export function ReviewPanel() {
  return (
    <MockFrame index="REVIEW · DR-0091" title="Рішення технічного нагляду" status={<Chip tone="ready">Прийнято</Chip>}>
      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-panel border border-status-ready-line bg-status-ready p-5">
          <p className="index-label text-status-ready-fg">Рішення зафіксовано</p>
          <p className="mt-4 text-h3 font-semibold text-status-ready-fg">Вимогу виконано</p>
          <p className="mt-2 text-data leading-relaxed text-status-ready-fg">
            Кріплення та маркування читаються. Додатковий матеріал не потрібен.
          </p>
        </div>
        <dl className="divide-y divide-line rounded-panel border border-line">
          <ReceiptRow term="Учасник" value="Інженер технічного нагляду" />
          <ReceiptRow term="Час рішення" value="20.08.2026 · 16:18" />
          <ReceiptRow term="Підстава" value="R-041 · EV-0248" />
          <ReceiptRow term="Наступний стан" value="Закриття дозволено" />
        </dl>
      </div>
    </MockFrame>
  );
}

export function ActPanel() {
  return (
    <MockFrame index="ACT · DRAFT-017" title="Акт прихованих робіт" status={<Chip tone="idle">Чернетка</Chip>}>
      <div role="region" aria-label="Факти чернетки акта" className="overflow-hidden rounded-panel border border-line">
        <Table>
          <thead>
            <Tr>
              <Th className="w-[30%]">Розділ</Th>
              <Th>Записаний факт</Th>
            </Tr>
          </thead>
          <tbody>
            <Tr><Td>Роботи</Td><Td>Монтаж кабельних трас ВРУ-1</Td></Tr>
            <Tr><Td>Проєкт</Td><Td>ЕОМ · аркуш 14 · ревізія 03</Td></Tr>
            <Tr><Td>Докази</Td><Td>EV-0248 · 3 матеріали</Td></Tr>
            <Tr><Td className="border-0">Рішення</Td><Td className="border-0">DR-0091 · прийнято</Td></Tr>
          </tbody>
        </Table>
      </div>
      <p className="mt-4 text-meta leading-relaxed text-ink-muted">
        Це підготовлена чернетка. Формальна перевірка й підписання відбуваються окремо.
      </p>
    </MockFrame>
  );
}

function MockFrame({
  index,
  title,
  status,
  children,
}: {
  index: string;
  title: string;
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel className="h-full overflow-hidden shadow-overlay">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-5">
        <p className="index-label text-ink-muted">{index}</p>
        <div className="ml-auto">{status}</div>
      </header>
      <div className="p-4 md:p-6">
        <h4 className="mb-5 text-h3 font-semibold text-ink">{title}</h4>
        {children}
      </div>
    </Panel>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-meta text-ink-muted">{label}</p>
      <p className="mt-1 text-data font-medium leading-relaxed text-ink">{value}</p>
    </div>
  );
}

function ReceiptRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 px-4 py-3 text-data">
      <dt className="text-meta text-ink-muted">{term}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
