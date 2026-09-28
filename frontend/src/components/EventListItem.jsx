import { Link } from 'react-router-dom'
import { formatDateTime } from '../lib/formatDate.js'

function EventListItem({ event }) {
  return (
    <li className="card event-card">
      <Link to={`/events/${event.id}`}>
        <p className="event-card-title">{event.title}</p>
        <p>{formatDateTime(event.startsAt)}</p>
        <p>
          {event.venue}
          {event.prefecture ? `（${event.prefecture}）` : ''}
        </p>
      </Link>
    </li>
  )
}

export default EventListItem
