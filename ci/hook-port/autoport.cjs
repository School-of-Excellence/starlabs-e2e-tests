const fs=require('fs');
const G="/Users/m1/Documents/CICD/starlabs-cicd/src/app/";
const A="/Users/m1/Documents/Angular Projects/Version 19/Starlabs 19/src/app/";
const files = process.argv.slice(2);
const FUNC = [/\(click\)="[^"]*"/,/\(change\)="[^"]*"/,/\(selectionChange\)="[^"]*"/,
  /formControlName="[^"]*"/,/\*ngFor="[^"]*"/,/\*ngIf="[^"]*"/,/\[\(ngModel\)\]="[^"]*"/,
  /\(submit\)="[^"]*"/,/type="submit"/,/\[checked\]="[^"]*"/,/\(selectionChange\)="[^"]*"/];
let OK=0,AMB=0,MISS=0,MAN=0;
for(const f of files){
  const gl=fs.readFileSync(G+f,'utf8').split('\n');
  let c=fs.readFileSync(A+f,'utf8');
  for(const line of gl){
    if(!/data-testid=/.test(line)) continue;
    const tidm=line.match(/data-testid="([^"]+)"/); if(!tidm) continue;
    const tid=tidm[1], inj='data-testid="'+tid+'"';
    if(c.includes(inj)){console.log('SKIP  '+tid);continue;}
    let anchor=null;
    for(const re of FUNC){const m=line.match(re);if(m){anchor=m[0];break;}}
    if(!anchor){console.log('MANUAL '+tid+'  (no functional anchor — text/icon element)');MAN++;continue;}
    const n=c.split(anchor).length-1;
    if(n===0){console.log('MISS  '+tid+'   ['+anchor+']');MISS++;}
    else if(n>1){console.log('AMBIG('+n+') '+tid+'   ['+anchor+']');AMB++;}
    else{c=c.replace(anchor,anchor+' '+inj);console.log('OK    '+tid);OK++;}
  }
  fs.writeFileSync(A+f,c);
}
console.log(`\n== OK ${OK} | AMBIG ${AMB} | MISS ${MISS} | MANUAL ${MAN} ==`);
