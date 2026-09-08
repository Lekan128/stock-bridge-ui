import { z } from 'zod'

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Must be 50 characters or fewer'),
  description: z.string().trim().max(255, 'Must be 255 characters or fewer'),
})

export type RoleFormValues = z.infer<typeof roleFormSchema>
