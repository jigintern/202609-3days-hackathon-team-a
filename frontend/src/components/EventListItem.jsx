function formatDate(isoString) {
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function EventListItem({ event }) {
  return (
    <li>
      <strong>{event.title}</strong>
      <div>{formatDate(event.startsAt)}</div>
      <div>
        {event.venue}
        {event.prefecture ? `（${event.prefecture}）` : ''}
      </div>
    </li>
  )
}

export default EventListItem
