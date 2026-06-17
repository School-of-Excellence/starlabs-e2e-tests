const fs=require('fs');
const A="/Users/m1/Documents/Angular Projects/Version 19/Starlabs 19/src/app/";
// [file, find, replace, mode('one'|'all')]
const E=[
 ["queue system/dynamic-studio/dynamic-studio.component.html", '>My Arena ({{ongoingQueue["queuename"]}})', ' data-testid="studio-arena-title">My Arena ({{ongoingQueue["queuename"]}})','one'],
 ["queue system/dynamic-studio/dynamic-studio.component.html", 'class="queue-card__meta"', 'class="queue-card__meta" data-testid="studio-queue-card-count"','one'],
 ["queue system/dynamic-studio/dynamic-studio.component.html", '<div class="token"', '<div class="token" data-testid="studio-token-card" [attr.data-token]="token.docid"','one'],
 ["queue system/dynamic-studio/dynamic-studio.component.html", 'class="profile-card__name"', 'class="profile-card__name" data-testid="studio-live-participant-name"','one'],
 ["queue system/dynamic-studio/dynamic-studio.component.html", '[disabled]="liveAssignment[\'zoomdata\'] === undefined"', '[disabled]="liveAssignment[\'zoomdata\'] === undefined" data-testid="studio-zoom-start-btn"','one'],
 ["queue system/dynamic-studio/dynamic-studio.component.html", '(click)="moveStage(config.stage, config.markascompleted)"', '(click)="moveStage(config.stage, config.markascompleted)" data-testid="studio-move-next-btn" [attr.data-stage]="config.stage"','all'],
 ["queue system/big-planner/big-planner.component.html", 'class="stat-value">{{profileStudioCount[invitation]?.length || 0}}', 'class="stat-value" data-testid="bp-stat-studios">{{profileStudioCount[invitation]?.length || 0}}','one'],
 ["queue system/big-planner/big-planner.component.html", 'class="stat-value">{{profilePairCount[invitation]?.length || 0}}', 'class="stat-value" data-testid="bp-stat-pair">{{profilePairCount[invitation]?.length || 0}}','one'],
 ["queue system/big-planner/big-planner.component.html", '*matRowDef="let row; columns: displayedColumns;"', '*matRowDef="let row; columns: displayedColumns;" data-testid="bp-studio-row" [attr.data-studio-id]="row[\'docid\']"','one'],
];
const byF={}; for(const e of E)(byF[e[0]]=byF[e[0]]||[]).push(e);
let OK=0,AMB=0,MISS=0;
for(const f in byF){const p=A+f; let c=fs.readFileSync(p,'utf8');
 for(const [,find,rep,mode] of byF[f]){
   const tid=rep.match(/data-testid="([^"]+)"/)[1];
   if(c.includes('data-testid="'+tid+'"')){console.log('SKIP  '+tid);continue;}
   const n=c.split(find).length-1;
   if(n===0){console.log('MISS  '+tid+'   find: '+find.slice(0,50));MISS++;}
   else if(mode==='all'){c=c.split(find).join(rep);console.log('OK x'+n+' '+tid);OK+=n;}
   else if(n>1){console.log('AMBIG('+n+') '+tid);AMB++;}
   else{c=c.replace(find,rep);console.log('OK    '+tid);OK++;}
 }
 fs.writeFileSync(p,c);
}
console.log(`\n== OK ${OK} | AMBIG ${AMB} | MISS ${MISS} ==`);
