import { Link } from 'react-router-dom'
import { format } from 'date-fns'

export default function EventCard({ update }) {
  const { id, title, content, image_url, hashtags = [], created_at, profiles } = update
  const authorName = profiles?.full_name || 'Family Member'
  const authorAvatar = profiles?.avatar_url

  return (
    <Link to={`/event/${id}`} className="block group">
      <div className="card hover:shadow-md transition-shadow duration-200">
        {image_url && (
          <div className="aspect-video overflow-hidden">
            <img
              src={image_url}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-4">
          <h3 className="font-display text-lg text-stone-900 group-hover:text-brand-700 transition-colors line-clamp-2">
            {title}
          </h3>
          {content && (
            <p className="mt-1 text-stone-500 text-sm line-clamp-2">{content}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1">
            {hashtags.map(tag => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
                {authorName[0].toUpperCase()}
              </div>
            )}
            <span>{authorName}</span>
            <span>·</span>
            <time dateTime={created_at}>{format(new Date(created_at), 'MMM d, yyyy')}</time>
          </div>
        </div>
      </div>
    </Link>
  )
}
