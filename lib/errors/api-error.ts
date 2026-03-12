// auto-stub
import { NextResponse } from "next/server"
export type ApiErrorCode = string
export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public status = 500) {
    super(message); this.name = 'ApiError'
  }
}
export const safeHandler = (fn: any) => fn
export const safeJson = (data: any, status = 200) => NextResponse.json(data, { status })
export default {}
