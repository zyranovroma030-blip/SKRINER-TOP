import { useState, useEffect } from 'react'
import { useScreenerStore } from '../store/screener'
import s from './Profile.module.css'

export default function Profile() {
  const { telegramChatId, setTelegramChatId } = useScreenerStore()
  const [input, setInput] = useState(telegramChatId)
  useEffect(() => setInput(telegramChatId), [telegramChatId])
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setTelegramChatId(input.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <h1 className={s.title}>Профиль</h1>
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Telegram Chat ID</h2>
          <p className={s.hint}>
            Активируйте бота (напишите /start) —{' '}
            <a href="https://t.me/digash_bot" target="_blank" rel="noopener noreferrer">ссылка</a>.
            Введите Chat ID (можно узнать{' '}
            <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">здесь</a>).
          </p>
          <div className={s.row}>
            <input
              className={s.input}
              placeholder="Например: 1323803389"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className={s.saveBtn} onClick={handleSave}>
              {saved ? 'Сохранено' : 'Сохранить'}
            </button>
          </div>
          <p className={s.note}>Значение сохраняется и не сбрасывается при перезапуске.</p>
        </section>
      </div>
    </div>
  )
}
