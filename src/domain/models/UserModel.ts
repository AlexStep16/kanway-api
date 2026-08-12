import { Schema, model, Model, HydratedDocument } from 'mongoose'
import { IUserRaw } from '@entities/IUserRaw.js'
import bcrypt from 'bcrypt'
import { BASE_COLORS } from '@constants/BASE_COLORS.js'
import { SALT_ROUNDS } from '@constants/SALT_ROUNDS.js'

interface IUserRawMethods {
  comparePassword(password: string): Promise<boolean>
}

interface IUserRawStatics extends Model<IUserRaw> {
  findByEmailWithPassword(
    email: string,
  ): Promise<HydratedDocument<IUserRaw, IUserRawMethods> | null>
}

export const UserSchema = new Schema<IUserRaw, IUserRawStatics, IUserRawMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: false,
    },
    password_hash: {
      type: String,
      select: false,
    },
    has_password: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deleted_time: {
      type: Date,
    },
    is_confirmed: {
      type: Boolean,
      default: false,
    },
    subscription_id: {
      type: Number,
      required: true,
    },
    subscription_until: {
      type: Date,
      required: false,
    },
    is_subscription_active: {
      type: Boolean,
      default: false,
    },
    credits: {
      type: Number,
      default: 200,
    },
    paid_credits: {
      type: Number,
      default: 0,
    },
    is_tips_completed: {
      type: Boolean,
      default: false,
    },
    avatar_color: {
      type: String,
      enum: BASE_COLORS,
      default: '#3b82f6',
    },
    avatar_url: {
      type: String,
    },
    timezone: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    yandex_user_id: {
      type: String,
    },
    vk_user_id: {
      type: String,
    },
    payment_method_id: {
      type: String,
    },
    payment_retries_count: {
      type: Number,
      default: 0,
    },
    pending_change_plan: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true },
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash') || !this.password_hash) return next()
  try {
    this.password_hash = await bcrypt.hash(this.password_hash, SALT_ROUNDS)
    next()
  } catch (error: any) {
    return next(error)
  }
})

UserSchema.statics.findByEmailWithPassword = async function (email: string) {
  return this.findOne({ email }).select('+password_hash').lean()
}

UserSchema.methods.comparePassword = async function (password: string) {
  if (!this.password_hash) return false
  return await bcrypt.compare(password, this.password_hash)
}

export const UserModel = model<IUserRaw, IUserRawStatics>('User', UserSchema)
