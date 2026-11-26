const jwt = require("jsonwebtoken");
const { get } = require("./sqlite");
function createAuthMiddleware(db, secret) {
  return async function authenticate(req,res,next) {
    const parts=(req.get("authorization")||"").trim().split(/\s+/);
    if(parts.length!==2 || parts[0].toLowerCase()!=="bearer") return res.status(401).json({error:"Authentication required"});
    try {
      const claims=jwt.verify(parts[1],secret,{algorithms:["HS256"],issuer:"farmer-store",audience:"farmer-store-api"});
      const id=Number(claims.sub); if(!Number.isSafeInteger(id)||id<=0||typeof claims.sid!=="string") throw new Error("bad claims");
      const user=await get(db,"SELECT u.id,u.name,u.email,u.is_admin,u.role,u.status,u.created_at,u.phone,u.profile_image_url,u.google_sub,u.password_hash,s.id AS session_id FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND s.id=? AND s.revoked_at IS NULL AND s.expires_at>?",[id,claims.sid,new Date().toISOString()]);
      if(!user||user.status!=="active") return res.status(401).json({error:"Invalid or expired session"});
      req.user={...user,is_admin:user.role==="admin"};return next();
    } catch { return res.status(401).json({error:"Invalid or expired session"}); }
  };
}
function requireRoles(...roles) { return (req,res,next)=>req.user&&roles.includes(req.user.role)?next():res.status(403).json({error:"Insufficient permissions"}); }
const requireAdmin=requireRoles("admin");
function createRateLimiter({windowMs,max}) { const buckets=new Map(); const cleanup=setInterval(()=>{const now=Date.now();for(const [key,value] of buckets)if(value.resetAt<=now)buckets.delete(key);},Math.max(1000,Math.min(windowMs,60000)));cleanup.unref?.();return(req,res,next)=>{const now=Date.now(),key=req.ip||req.socket.remoteAddress||"unknown";let b=buckets.get(key);if(!b||b.resetAt<=now)buckets.set(key,b={count:0,resetAt:now+windowMs});b.count++;res.set("RateLimit-Limit",String(max));res.set("RateLimit-Remaining",String(Math.max(0,max-b.count)));if(b.count>max){res.set("Retry-After",String(Math.ceil((b.resetAt-now)/1000)));return res.status(429).json({error:"Too many authentication attempts. Try again later."});}return next();}; }
function safeErrorHandler(error,req,res,_next) { if(res.headersSent)return;if(error?.type==="entity.parse.failed"||error?.type==="entity.too.large")return res.status(error.type==="entity.too.large"?413:400).json({error:error.type==="entity.too.large"?"Request body is too large":"Malformed JSON request"});if(error?.message==="CORS origin denied")return res.status(403).json({error:"Origin not allowed"});return res.status(500).json({error:"Internal server error"}); }
module.exports={createAuthMiddleware,requireAdmin,requireRoles,createRateLimiter,safeErrorHandler};
