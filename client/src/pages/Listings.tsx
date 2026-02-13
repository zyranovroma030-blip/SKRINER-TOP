import s from './Placeholder.module.css'

export default function Listings() {
  return (
    <div className={s.wrap}>
      <h1 className={s.title}>Листинги</h1>
      <p className={s.text}>Новые листинги фьючерсов на Bybit. Данные обновляются с биржи. Оповещения о листингах настраиваются во вкладке «Оповещения».</p>
    </div>
  )
}
