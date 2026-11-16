// Lautheit der Analysen auf Spotify-Niveau schieben (+dB), einmalig je Datei (meta.cal merkt es)
const fs=require('fs'),path=require('path');const [dir,db]=[process.argv[2],+process.argv[3]];let n=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const p=path.join(dir,f);const a=JSON.parse(fs.readFileSync(p,'utf8'));if(a.meta?.cal)continue;
 a.track.loudness=+(a.track.loudness+db).toFixed(2);for(const s of a.segments){s.loudness_start=+(s.loudness_start+db).toFixed(2);s.loudness_max=+(s.loudness_max+db).toFixed(2);}
 for(const s of a.sections)s.loudness=+(s.loudness+db).toFixed(2);a.meta={...(a.meta||{}),cal:db};fs.writeFileSync(p,JSON.stringify(a));n++;}
console.log(dir,n,'files +'+db+' dB');
