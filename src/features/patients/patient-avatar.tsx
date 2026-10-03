import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarFor } from './avatar'

/**
 * A patient's photo: their `photoUrl` when we have one, otherwise the demo
 * portrait for their sex and id. The person icon only shows if the image fails
 * to load (for example offline).
 */
export function PatientAvatar({
  id,
  sex,
  photoUrl,
  className,
}: {
  id: string
  sex: 'F' | 'M'
  photoUrl?: string
  className?: string
}) {
  return (
    <Avatar className={cn('size-14 bg-muted', className)}>
      {/* Decorative: the patient's name is always shown next to it. */}
      <AvatarImage src={photoUrl ?? avatarFor(sex, id)} alt='' />
      <AvatarFallback>
        <User className='size-1/2 text-muted-foreground' aria-hidden />
      </AvatarFallback>
    </Avatar>
  )
}
