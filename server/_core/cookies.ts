import type { CookieOptions, Request } from "express";
function isSecureRequest(req:Request){if(req.protocol==="https")return true;const forwarded=req.headers["x-forwarded-proto"];if(!forwarded)return false;const list=Array.isArray(forwarded)?forwarded:forwarded.split(",");return list.some(p=>p.trim().toLowerCase()==="https")}
export function getSessionCookieOptions(req:Request):Pick<CookieOptions,"domain"|"httpOnly"|"path"|"sameSite"|"secure">{return{httpOnly:true,path:"/",sameSite:"none",secure:isSecureRequest(req)}}
