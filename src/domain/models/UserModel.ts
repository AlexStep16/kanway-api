import { Schema, model, Model, HydratedDocument } from 'mongoose'
import { IUserRaw } from '@entities/IUserRaw.ts'
import bcrypt from 'bcrypt'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

const SALT_ROUNDS = 10

interface IUserRawMethods {
  comparePassword(password: string): Promise<boolean>
}

interface IUserRawStatics extends Model<IUserRaw> {
  findByEmailWithPassword(
    email: string
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
      required: true,
      select: false,
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
    subscription: {
      type: String,
      default: 'trial',
    },
    subscription_until: {
      type: Date,
      required: false,
    },
    generations_balance: {
      type: Number,
      default: 20,
    },
    is_password_in_reset_state: {
      type: Boolean,
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
    phone: {
      type: String,
    },
    ya_avatar_id: {
      type: String,
    },
    ya_id: {
      type: String,
    },
    payment_method_id: {
      type: String,
    },
  },
  { timestamps: true }
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next()
  try {
    this.password_hash = await bcrypt.hash(this.password_hash, SALT_ROUNDS)
    next()
  } catch (error: any) {
    return next(error)
  }
})

UserSchema.statics.findByEmailWithPassword = async function (email: string) {
  return this.findOne({ email }).select('+password_hash')
}

UserSchema.methods.comparePassword = function (password: string) {
  return bcrypt.compare(password, this.password_hash)
}

export const UserModel = model<IUserRaw, IUserRawStatics>('User', UserSchema)
