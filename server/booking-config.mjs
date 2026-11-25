import publicConfig from './public-config.cjs';
export function bookingConfig(env={}){
 if(env.NAITEA_BOOKINGS_ENABLED!=='true'||env.NAITEA_AUTH_ENABLED!=='true'||env.NAITEA_WORKSHOPS_ENABLED!=='true'||env.NAITEA_PUBLICATION_ENABLED!=='true')return null;
 const config=publicConfig.readPublicConfig(env);
 const service=env.NAITEA_BOOKING_SUPABASE_SECRET,site=env.NAITEA_TURNSTILE_SITE_KEY,secret=env.NAITEA_TURNSTILE_SECRET_KEY,brevo=env.NAITEA_BOOKING_BREVO_KEY,sender=env.NAITEA_BOOKING_SENDER,origin=env.NAITEA_BOOKING_ORIGIN;
 if(!config||typeof service!=='string'||!/^sb_secret_[A-Za-z0-9_-]{20,200}$/.test(service)||typeof site!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(site)||typeof secret!=='string'||secret.length<10||typeof brevo!=='string'||brevo.length<10||typeof sender!=='string'||!/^[^@\s]+@naitea\.fr$/i.test(sender)||typeof origin!=='string'||!/^https:\/\/[a-z0-9.-]+$/.test(origin))return null;
 try{if(new URL(origin).origin!==origin)return null;}catch{return null;}
 return {...config,service,site,secret,brevo,sender,origin};
}
