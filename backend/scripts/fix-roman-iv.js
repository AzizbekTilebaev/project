import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Aralash rim raqamlarini (kirill І + lotin V) lotinga birlashtirish
await db.query(
  "UPDATE titles SET soz=REPLACE(soz,'\u0406V','IV'), normalized=REPLACE(normalized,'\u0456v','iv') WHERE soz LIKE '%\u0406V'"
);
const [r] = await db.query("SELECT soz FROM titles WHERE soz LIKE '%IV'");
console.log(r.map((x) => x.soz).join(', '));
await db.end();
