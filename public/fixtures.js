/* ═══════════════════════════════════════════════════════
   GRUPOS, FIXTURES Y CRUCES FIFA MUNDIAL 2026
   Sorteo: 5 diciembre 2025, Kennedy Center, Washington D.C.
   Fuente: FIFA.com / El Comercio / bracketmundial2026.com
═══════════════════════════════════════════════════════ */
(function(scope){
const GROUPS = {
  A:{name:'Grupo A',teams:['México','Sudáfrica','Corea del Sur','Rep. Checa'],flags:['🇲🇽','🇿🇦','🇰🇷','🇨🇿']},
  B:{name:'Grupo B',teams:['Canadá','Bosnia y Herzegovina','Qatar','Suiza'],flags:['🇨🇦','🇧🇦','🇶🇦','🇨🇭']},
  C:{name:'Grupo C',teams:['Brasil','Marruecos','Haití','Escocia'],flags:['🇧🇷','🇲🇦','🇭🇹','🏴󠁧󠁢󠁳󠁣󠁴󠁿']},
  D:{name:'Grupo D',teams:['Estados Unidos','Paraguay','Australia','Turquía'],flags:['🇺🇸','🇵🇾','🇦🇺','🇹🇷']},
  E:{name:'Grupo E',teams:['Alemania','Curazao','Costa de Marfil','Ecuador'],flags:['🇩🇪','🇨🇼','🇨🇮','🇪🇨']},
  F:{name:'Grupo F',teams:['Países Bajos','Japón','Suecia','Túnez'],flags:['🇳🇱','🇯🇵','🇸🇪','🇹🇳']},
  G:{name:'Grupo G',teams:['Bélgica','Egipto','Irán','Nueva Zelanda'],flags:['🇧🇪','🇪🇬','🇮🇷','🇳🇿']},
  H:{name:'Grupo H',teams:['España','Cabo Verde','Arabia Saudita','Uruguay'],flags:['🇪🇸','🇨🇻','🇸🇦','🇺🇾']},
  I:{name:'Grupo I',teams:['Francia','Senegal','Irak','Noruega'],flags:['🇫🇷','🇸🇳','🇮🇶','🇳🇴']},
  J:{name:'Grupo J',teams:['Argentina','Argelia','Austria','Jordania'],flags:['🇦🇷','🇩🇿','🇦🇹','🇯🇴']},
  K:{name:'Grupo K',teams:['Portugal','RD Congo','Uzbekistán','Colombia'],flags:['🇵🇹','🇨🇩','🇺🇿','🇨🇴']},
  L:{name:'Grupo L',teams:['Inglaterra','Croacia','Ghana','Panamá'],flags:['🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇭🇷','🇬🇭','🇵🇦']},
};

const ALL_TEAMS = Object.values(GROUPS).flatMap(g=>g.teams);

const GROUP_FIXTURES = {
  A:[
    {j:1,d:'Jue 11 jun',home:0,away:1,sede:'Azteca'},
    {j:1,d:'Jue 11 jun',home:2,away:3,sede:'Akron'},
    {j:2,d:'Jue 18 jun',home:2,away:1,sede:'Atlanta'},
    {j:2,d:'Jue 18 jun',home:0,away:2,sede:'Akron'},
    {j:3,d:'Mié 24 jun',home:3,away:0,sede:'Azteca'},
    {j:3,d:'Mié 24 jun',home:1,away:2,sede:'BBVA'},
  ],
  B:[
    {j:1,d:'Vie 12 jun',home:0,away:1,sede:'BMO Field'},
    {j:1,d:'Sáb 13 jun',home:2,away:3,sede:'Levi\'s'},
    {j:2,d:'Jue 18 jun',home:3,away:1,sede:'SoFi'},
    {j:2,d:'Jue 18 jun',home:0,away:2,sede:'BC Place'},
    {j:3,d:'Mié 24 jun',home:3,away:0,sede:'BC Place'},
    {j:3,d:'Mié 24 jun',home:1,away:2,sede:'Lumen Field'},
  ],
  C:[
    {j:1,d:'Sáb 13 jun',home:0,away:1,sede:'MetLife'},
    {j:1,d:'Sáb 13 jun',home:2,away:3,sede:'Gillette'},
    {j:2,d:'Vie 19 jun',home:3,away:1,sede:'Gillette'},
    {j:2,d:'Vie 19 jun',home:0,away:2,sede:'Lincoln Fin.'},
    {j:3,d:'Mié 24 jun',home:0,away:3,sede:'Hard Rock'},
    {j:3,d:'Mié 24 jun',home:1,away:2,sede:'Mercedes-Benz'},
  ],
  D:[
    {j:1,d:'Vie 12 jun',home:0,away:1,sede:'SoFi'},
    {j:1,d:'Sáb 13 jun',home:2,away:3,sede:'BC Place'},
    {j:2,d:'Sáb 19 jun',home:0,away:2,sede:'Lumen Field'},
    {j:2,d:'Sáb 19 jun',home:3,away:1,sede:'Levi\'s'},
    {j:3,d:'Jue 25 jun',home:1,away:2,sede:'Levi\'s'},
    {j:3,d:'Jue 25 jun',home:3,away:0,sede:'SoFi'},
  ],
  E:[
    {j:1,d:'Dom 14 jun',home:0,away:1,sede:'NRG'},
    {j:1,d:'Dom 14 jun',home:2,away:3,sede:'Lincoln Fin.'},
    {j:2,d:'Sáb 20 jun',home:0,away:2,sede:'BMO Field'},
    {j:2,d:'Sáb 20 jun',home:3,away:1,sede:'Arrowhead'},
    {j:3,d:'Jue 25 jun',home:3,away:0,sede:'MetLife'},
    {j:3,d:'Jue 25 jun',home:1,away:2,sede:'Lincoln Fin.'},
  ],
  F:[
    {j:1,d:'Dom 14 jun',home:0,away:1,sede:'AT&T'},
    {j:1,d:'Dom 14 jun',home:2,away:3,sede:'BBVA'},
    {j:2,d:'Sáb 20 jun',home:0,away:2,sede:'NRG'},
    {j:2,d:'Sáb 20 jun',home:3,away:1,sede:'BBVA'},
    {j:3,d:'Jue 25 jun',home:3,away:0,sede:'Arrowhead'},
    {j:3,d:'Jue 25 jun',home:1,away:2,sede:'AT&T'},
  ],
  G:[
    {j:1,d:'Lun 15 jun',home:0,away:1,sede:'Lumen Field'},
    {j:1,d:'Lun 15 jun',home:2,away:3,sede:'SoFi'},
    {j:2,d:'Dom 21 jun',home:0,away:2,sede:'SoFi'},
    {j:2,d:'Dom 21 jun',home:3,away:1,sede:'Lincoln Fin.'},
    {j:3,d:'Mié 25 jun',home:1,away:2,sede:'Gillette'},
    {j:3,d:'Mié 25 jun',home:3,away:0,sede:'Lumen Field'},
  ],
  H:[
    {j:1,d:'Lun 15 jun',home:0,away:1,sede:'MetLife'},
    {j:1,d:'Lun 15 jun',home:2,away:3,sede:'Hard Rock'},
    {j:2,d:'Dom 21 jun',home:0,away:2,sede:'NRG'},
    {j:2,d:'Dom 21 jun',home:3,away:1,sede:'MetLife'},
    {j:3,d:'Jue 26 jun',home:1,away:2,sede:'Gillette'},
    {j:3,d:'Jue 26 jun',home:3,away:0,sede:'SoFi'},
  ],
  I:[
    {j:1,d:'Mar 16 jun',home:0,away:1,sede:'AT&T'},
    {j:1,d:'Mar 16 jun',home:2,away:3,sede:'Arrowhead'},
    {j:2,d:'Lun 22 jun',home:0,away:2,sede:'MetLife'},
    {j:2,d:'Lun 22 jun',home:3,away:1,sede:'NRG'},
    {j:3,d:'Vie 26 jun',home:3,away:0,sede:'Lumen Field'},
    {j:3,d:'Vie 26 jun',home:1,away:2,sede:'AT&T'},
  ],
  J:[
    {j:1,d:'Mar 16 jun',home:0,away:1,sede:'Mercedes-Benz'},
    {j:1,d:'Mar 16 jun',home:2,away:3,sede:'BC Place'},
    {j:2,d:'Lun 22 jun',home:0,away:2,sede:'Hard Rock'},
    {j:2,d:'Lun 22 jun',home:3,away:1,sede:'Levi\'s'},
    {j:3,d:'Sáb 27 jun',home:1,away:2,sede:'BMO Field'},
    {j:3,d:'Sáb 27 jun',home:3,away:0,sede:'Lincoln Fin.'},
  ],
  K:[
    {j:1,d:'Mié 17 jun',home:0,away:1,sede:'SoFi'},
    {j:1,d:'Mié 17 jun',home:2,away:3,sede:'AT&T'},
    {j:2,d:'Mar 23 jun',home:0,away:2,sede:'Levi\'s'},
    {j:2,d:'Mar 23 jun',home:3,away:1,sede:'Mercedes-Benz'},
    {j:3,d:'Sáb 27 jun',home:3,away:0,sede:'NRG'},
    {j:3,d:'Sáb 27 jun',home:1,away:2,sede:'Arrowhead'},
  ],
  L:[
    {j:1,d:'Mié 17 jun',home:0,away:1,sede:'AT&T'},
    {j:1,d:'Mié 17 jun',home:2,away:3,sede:'BC Place'},
    {j:2,d:'Mar 23 jun',home:0,away:2,sede:'Mercedes-Benz'},
    {j:2,d:'Mar 23 jun',home:3,away:1,sede:'Lumen Field'},
    {j:3,d:'Sáb 27 jun',home:1,away:2,sede:'Levi\'s'},
    {j:3,d:'Sáb 27 jun',home:3,away:0,sede:'Hard Rock'},
  ],
};

const R32 = [
  {id:'m1', lbl:'Partido 1',  sl1:'1º A', sl2:'2º B', g1:'A',p1:1,g2:'B',p2:2},
  {id:'m2', lbl:'Partido 2',  sl1:'1º C', sl2:'2º D', g1:'C',p1:1,g2:'D',p2:2},
  {id:'m3', lbl:'Partido 3',  sl1:'1º E', sl2:'2º F', g1:'E',p1:1,g2:'F',p2:2},
  {id:'m4', lbl:'Partido 4',  sl1:'1º G', sl2:'2º H', g1:'G',p1:1,g2:'H',p2:2},
  {id:'m5', lbl:'Partido 5',  sl1:'1º I', sl2:'2º J', g1:'I',p1:1,g2:'J',p2:2},
  {id:'m6', lbl:'Partido 6',  sl1:'1º K', sl2:'2º L', g1:'K',p1:1,g2:'L',p2:2},
  {id:'m7', lbl:'Partido 7',  sl1:'1º B', sl2:'2º A', g1:'B',p1:1,g2:'A',p2:2},
  {id:'m8', lbl:'Partido 8',  sl1:'1º D', sl2:'2º C', g1:'D',p1:1,g2:'C',p2:2},
  {id:'m9', lbl:'Partido 9',  sl1:'1º F', sl2:'2º E', g1:'F',p1:1,g2:'E',p2:2},
  {id:'m10',lbl:'Partido 10', sl1:'1º H', sl2:'2º G', g1:'H',p1:1,g2:'G',p2:2},
  {id:'m11',lbl:'Partido 11', sl1:'1º J', sl2:'2º I', g1:'J',p1:1,g2:'I',p2:2},
  {id:'m12',lbl:'Partido 12', sl1:'1º L', sl2:'2º K', g1:'L',p1:1,g2:'K',p2:2},
  {id:'m13',lbl:'Partido 13', sl1:'1º A', sl2:'Mej.3º',g1:'A',p1:1,g2:null,p2:3},
  {id:'m14',lbl:'Partido 14', sl1:'1º G', sl2:'Mej.3º',g1:'G',p1:1,g2:null,p2:3},
  {id:'m15',lbl:'Partido 15', sl1:'1º D', sl2:'Mej.3º',g1:'D',p1:1,g2:null,p2:3},
  {id:'m16',lbl:'Partido 16', sl1:'1º L', sl2:'Mej.3º',g1:'L',p1:1,g2:null,p2:3},
];

const R16 = [
  {id:'r16_1',lbl:'Octavos 1',sub:'G. P1 vs G. P2'},
  {id:'r16_2',lbl:'Octavos 2',sub:'G. P3 vs G. P4'},
  {id:'r16_3',lbl:'Octavos 3',sub:'G. P5 vs G. P6'},
  {id:'r16_4',lbl:'Octavos 4',sub:'G. P7 vs G. P8'},
  {id:'r16_5',lbl:'Octavos 5',sub:'G. P9 vs G. P10'},
  {id:'r16_6',lbl:'Octavos 6',sub:'G. P11 vs P12'},
  {id:'r16_7',lbl:'Octavos 7',sub:'G. P13 vs P14'},
  {id:'r16_8',lbl:'Octavos 8',sub:'G. P15 vs P16'},
];
const QF = [
  {id:'qf_1',lbl:'Cuartos 1',sub:'G. Oct1 vs Oct2'},
  {id:'qf_2',lbl:'Cuartos 2',sub:'G. Oct3 vs Oct4'},
  {id:'qf_3',lbl:'Cuartos 3',sub:'G. Oct5 vs Oct6'},
  {id:'qf_4',lbl:'Cuartos 4',sub:'G. Oct7 vs Oct8'},
];
const SF = [
  {id:'sf_1',lbl:'Semifinal 1',sub:'G. CF1 vs CF2'},
  {id:'sf_2',lbl:'Semifinal 2',sub:'G. CF3 vs CF4'},
];

const FIXTURES = {GROUPS, ALL_TEAMS, GROUP_FIXTURES, R32, R16, QF, SF};

if (typeof module !== 'undefined' && module.exports) module.exports = FIXTURES;
else { scope.GROUPS = GROUPS; scope.ALL_TEAMS = ALL_TEAMS; scope.GROUP_FIXTURES = GROUP_FIXTURES; scope.R32 = R32; scope.R16 = R16; scope.QF = QF; scope.SF = SF; }
})(typeof window !== 'undefined' ? window : globalThis);
