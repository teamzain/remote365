// Provisions only an isolated Apple-review account on the known preprod host.
// Never prints the generated password or authentication tokens.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const host = 'root@206.189.127.215';
const domain = 'pp.remote365.ai';
const email = 'zainulabidden837+remote365-review@gmail.com';
const credentialPath = path.resolve(__dirname, '../apps/remote-365-mobile/credentials/apple-review-account.json');
function remote(source) {
  return JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', host,
    'docker exec -i remotelink-desktop-auth-service-1 node'],
  { input: source, encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }).trim());
}
const prelude = `
const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
if (process.env.DOMAIN !== ${JSON.stringify(domain)}) throw new Error('Not the expected preprod domain');
const dbHost = new URL(process.env.DATABASE_URL).hostname;
if (dbHost !== 'postgres') throw new Error('Unexpected database host');
`;
async function main() {
  const inspection = remote(prelude + `
(async () => {
  const user = await prisma.user.findUnique({where:{email:${JSON.stringify(email)}},select:{id:true,role:true,organizationId:true}});
  console.log(JSON.stringify({domain:process.env.DOMAIN,dbHost,existingAccount:!!user}));
})().finally(()=>prisma.$disconnect());`);
  console.log(JSON.stringify(inspection));
  if (!process.argv.includes('--create')) return;
  if (inspection.existingAccount) throw new Error('Review account already exists; refusing to overwrite it');
  const credentials = fs.existsSync(credentialPath)
    ? JSON.parse(fs.readFileSync(credentialPath, 'utf8'))
    : { email, password: randomBytes(24).toString('base64url'), baseUrl: `https://${domain}`, createdAt: new Date().toISOString() };
  if (credentials.email !== email || credentials.baseUrl !== `https://${domain}`) throw new Error('Unexpected saved credential target');
  fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
  if (!fs.existsSync(credentialPath)) fs.writeFileSync(credentialPath, JSON.stringify(credentials, null, 2), { flag: 'wx', mode: 0o600 });
  const result = remote(prelude + `
const credential = ${JSON.stringify(credentials)};
(async () => {
  const password = await bcrypt.hash(credential.password,12);
  const result = await prisma.$transaction(async tx => {
    if (await tx.user.findUnique({where:{email:credential.email}})) throw new Error('Account exists');
    const org = await tx.organization.create({data:{name:'Remote365 Apple Review',slug:'remote365-apple-review-'+Date.now()}});
    const user = await tx.user.create({data:{email:credential.email,password,name:'Apple App Review',role:'OWNER',organizationId:org.id,allowedDeviceIds:['__all__'],marketingMessages:false}});
    const supportsPlatform = Prisma.dmmf.datamodel.models.find(m=>m.name==='Subscription').fields.some(f=>f.name==='platform');
    await tx.subscription.create({data:{userId:user.id,plan:'BUSINESS',status:'ACTIVE',...(supportsPlatform?{platform:'MANUAL'}:{}),currentPeriodEnd:null}});
    await tx.activityLog.create({data:{organizationId:org.id,actorId:user.id,actorName:'Apple App Review',action:'ORG_CREATED',message:'Dedicated preprod Apple review workspace; manual non-expiring test access; no billing charge.'}});
    return {created:true,userId:user.id,organizationId:org.id,plan:'BUSINESS',platform:'MANUAL',expiresAt:null};
  });
  console.log(JSON.stringify(result));
})().catch(err=>{console.log(JSON.stringify({created:false,errorCode:err.code||null,errorType:err.name,error:String(err.message).replaceAll(credential.password,'[redacted]').replace(/\\$2[aby]\\$[^\\s\"']+/g,'[redacted-hash]')}))}).finally(()=>prisma.$disconnect());`);
  console.log(JSON.stringify(result));
  if (!result.created) throw new Error('Review account was not created');
  const login = await fetch(credentials.baseUrl+'/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:credentials.email,password:credentials.password})});
  const session = await login.json();
  if (!login.ok || session.twoFactorRequired) throw new Error('Review login verification failed');
  const token = session.accessToken || session.token;
  if (!token) throw new Error('Login returned no access token');
  const meResponse = await fetch(credentials.baseUrl+'/api/auth/me',{headers:{Authorization:'Bearer '+token}});
  const me = await meResponse.json();
  if (!meResponse.ok || me.email !== email) throw new Error('Review identity verification failed');
  console.log(JSON.stringify({loginVerified:true,email:me.email,role:me.role,credentialPath}));
}
main().catch(err => {console.error(err.status !== undefined ? 'Remote operation failed; no credentials logged.' : err.message);process.exitCode=1;});
