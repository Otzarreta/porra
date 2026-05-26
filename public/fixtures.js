/* ==========================================================================
   Mundial 2026: equipos, fixtures, clasificacion y cuadro oficial FIFA.
   Fuente normativa: FIFA Regulations 2026, Annexe C.
========================================================================== */
(function(scope) {
  const GROUP_ORDER = 'ABCDEFGHIJKL'.split('');

  const GROUP_SEEDS = {
    A: [
      ['mexico', 'México', '🇲🇽'],
      ['south-africa', 'Sudáfrica', '🇿🇦'],
      ['south-korea', 'Corea del Sur', '🇰🇷'],
      ['czech-republic', 'Rep. Checa', '🇨🇿'],
    ],
    B: [
      ['canada', 'Canadá', '🇨🇦'],
      ['bosnia-herzegovina', 'Bosnia y Herzegovina', '🇧🇦'],
      ['qatar', 'Qatar', '🇶🇦'],
      ['switzerland', 'Suiza', '🇨🇭'],
    ],
    C: [
      ['brazil', 'Brasil', '🇧🇷'],
      ['morocco', 'Marruecos', '🇲🇦'],
      ['haiti', 'Haití', '🇭🇹'],
      ['scotland', 'Escocia', '🏴'],
    ],
    D: [
      ['usa', 'Estados Unidos', '🇺🇸'],
      ['paraguay', 'Paraguay', '🇵🇾'],
      ['australia', 'Australia', '🇦🇺'],
      ['turkey', 'Turquía', '🇹🇷'],
    ],
    E: [
      ['germany', 'Alemania', '🇩🇪'],
      ['curacao', 'Curazao', '🇨🇼'],
      ['ivory-coast', 'Costa de Marfil', '🇨🇮'],
      ['ecuador', 'Ecuador', '🇪🇨'],
    ],
    F: [
      ['netherlands', 'Países Bajos', '🇳🇱'],
      ['japan', 'Japón', '🇯🇵'],
      ['sweden', 'Suecia', '🇸🇪'],
      ['tunisia', 'Túnez', '🇹🇳'],
    ],
    G: [
      ['belgium', 'Bélgica', '🇧🇪'],
      ['egypt', 'Egipto', '🇪🇬'],
      ['iran', 'Irán', '🇮🇷'],
      ['new-zealand', 'Nueva Zelanda', '🇳🇿'],
    ],
    H: [
      ['spain', 'España', '🇪🇸'],
      ['cape-verde', 'Cabo Verde', '🇨🇻'],
      ['saudi-arabia', 'Arabia Saudita', '🇸🇦'],
      ['uruguay', 'Uruguay', '🇺🇾'],
    ],
    I: [
      ['france', 'Francia', '🇫🇷'],
      ['senegal', 'Senegal', '🇸🇳'],
      ['iraq', 'Irak', '🇮🇶'],
      ['norway', 'Noruega', '🇳🇴'],
    ],
    J: [
      ['argentina', 'Argentina', '🇦🇷'],
      ['algeria', 'Argelia', '🇩🇿'],
      ['austria', 'Austria', '🇦🇹'],
      ['jordan', 'Jordania', '🇯🇴'],
    ],
    K: [
      ['portugal', 'Portugal', '🇵🇹'],
      ['dr-congo', 'RD Congo', '🇨🇩'],
      ['uzbekistan', 'Uzbekistán', '🇺🇿'],
      ['colombia', 'Colombia', '🇨🇴'],
    ],
    L: [
      ['england', 'Inglaterra', '🏴'],
      ['croatia', 'Croacia', '🇭🇷'],
      ['ghana', 'Ghana', '🇬🇭'],
      ['panama', 'Panamá', '🇵🇦'],
    ],
  };

  const GROUPS = {};
  const TEAMS = {};
  GROUP_ORDER.forEach((group, groupIndex) => {
    GROUPS[group] = {
      id: group,
      name: `Grupo ${group}`,
      teams: GROUP_SEEDS[group].map(([id, name, flag], seedIndex) => {
        const team = {
          id,
          name,
          flag,
          group,
          seed: seedIndex + 1,
          fallbackRank: groupIndex * 4 + seedIndex + 1,
        };
        TEAMS[id] = team;
        return team;
      }),
    };
  });

  const ALL_TEAMS = Object.values(TEAMS);
  const TEAM_IDS = ALL_TEAMS.map(team => team.id);
  const ALL_TEAM_NAMES = ALL_TEAMS.map(team => team.name);

  const GROUP_MATCH_PATTERN = [
    {j: 1, home: 0, away: 1},
    {j: 1, home: 2, away: 3},
    {j: 2, home: 0, away: 2},
    {j: 2, home: 3, away: 1},
    {j: 3, home: 3, away: 0},
    {j: 3, home: 1, away: 2},
  ];

  const GROUP_FIXTURES = Object.fromEntries(GROUP_ORDER.map(group => {
    const fixtures = GROUP_MATCH_PATTERN.map((pattern, idx) => ({
      ...pattern,
      idx,
      id: `${group}${idx + 1}`,
      group,
      homeId: GROUPS[group].teams[pattern.home].id,
      awayId: GROUPS[group].teams[pattern.away].id,
    }));
    return [group, fixtures];
  }));

  const ROUND_OF_32 = [
    match('M73', 'r32', pos('A', 2), pos('B', 2)),
    match('M74', 'r32', pos('E', 1), third('E', 'ABCDF')),
    match('M75', 'r32', pos('F', 1), pos('C', 2)),
    match('M76', 'r32', pos('C', 1), pos('F', 2)),
    match('M77', 'r32', pos('I', 1), third('I', 'CDFGH')),
    match('M78', 'r32', pos('E', 2), pos('I', 2)),
    match('M79', 'r32', pos('A', 1), third('A', 'CEFHI')),
    match('M80', 'r32', pos('L', 1), third('L', 'EHIJK')),
    match('M81', 'r32', pos('D', 1), third('D', 'BEFIJ')),
    match('M82', 'r32', pos('G', 1), third('G', 'AEHIJ')),
    match('M83', 'r32', pos('K', 2), pos('L', 2)),
    match('M84', 'r32', pos('H', 1), pos('J', 2)),
    match('M85', 'r32', pos('B', 1), third('B', 'EFGIJ')),
    match('M86', 'r32', pos('J', 1), pos('H', 2)),
    match('M87', 'r32', pos('K', 1), third('K', 'DEIJL')),
    match('M88', 'r32', pos('D', 2), pos('G', 2)),
  ];

  const NEXT_ROUNDS = [
    match('M89', 'r16', winner('M74'), winner('M77')),
    match('M90', 'r16', winner('M73'), winner('M75')),
    match('M91', 'r16', winner('M76'), winner('M78')),
    match('M92', 'r16', winner('M79'), winner('M80')),
    match('M93', 'r16', winner('M83'), winner('M84')),
    match('M94', 'r16', winner('M81'), winner('M82')),
    match('M95', 'r16', winner('M86'), winner('M88')),
    match('M96', 'r16', winner('M85'), winner('M87')),
    match('M97', 'qf', winner('M89'), winner('M90')),
    match('M98', 'qf', winner('M93'), winner('M94')),
    match('M99', 'qf', winner('M91'), winner('M92')),
    match('M100', 'qf', winner('M95'), winner('M96')),
    match('M101', 'sf', winner('M97'), winner('M98')),
    match('M102', 'sf', winner('M99'), winner('M100')),
    match('M104', 'final', winner('M101'), winner('M102')),
  ];

  const BRACKET_MATCHES = [...ROUND_OF_32, ...NEXT_ROUNDS];
  const BRACKET_BY_ROUND = {
    r32: ROUND_OF_32,
    r16: BRACKET_MATCHES.filter(m => m.round === 'r16'),
    qf: BRACKET_MATCHES.filter(m => m.round === 'qf'),
    sf: BRACKET_MATCHES.filter(m => m.round === 'sf'),
    final: BRACKET_MATCHES.filter(m => m.round === 'final'),
  };

  // Annexe C completa: key = grupos de terceros clasificados; value = rivales de 1A,1B,1D,1E,1G,1I,1K,1L.
  const THIRD_PLACE_COLUMNS = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'];
  const THIRD_PLACE_ASSIGNMENTS_RAW = `
EFGHIJKL:EJIFHGLK
DFGHIJKL:HGIDJFLK
DEGHIJKL:EJIDHGLK
DEFHIJKL:EJIDHFLK
DEFGIJKL:EGIDJFLK
DEFGHJKL:EGJDHFLK
DEFGHIKL:EGIDHFLK
DEFGHIJL:EGJDHFLI
DEFGHIJK:EGJDHFIK
CFGHIJKL:HGICJFLK
CEGHIJKL:EJICHGLK
CEFHIJKL:EJICHFLK
CEFGIJKL:EGICJFLK
CEFGHJKL:EGJCHFLK
CEFGHIKL:EGICHFLK
CEFGHIJL:EGJCHFLI
CEFGHIJK:EGJCHFIK
CDGHIJKL:HGICJDLK
CDFHIJKL:CJIDHFLK
CDFGIJKL:CGIDJFLK
CDFGHJKL:CGJDHFLK
CDFGHIKL:CGIDHFLK
CDFGHIJL:CGJDHFLI
CDFGHIJK:CGJDHFIK
CDEHIJKL:EJICHDLK
CDEGIJKL:EGICJDLK
CDEGHJKL:EGJCHDLK
CDEGHIKL:EGICHDLK
CDEGHIJL:EGJCHDLI
CDEGHIJK:EGJCHDIK
CDEFIJKL:CJEDIFLK
CDEFHJKL:CJEDHFLK
CDEFHIKL:CEIDHFLK
CDEFHIJL:CJEDHFLI
CDEFHIJK:CJEDHFIK
CDEFGJKL:CGEDJFLK
CDEFGIKL:CGEDIFLK
CDEFGIJL:CGEDJFLI
CDEFGIJK:CGEDJFIK
CDEFGHKL:CGEDHFLK
CDEFGHJL:CGJDHFLE
CDEFGHJK:CGJDHFEK
CDEFGHIL:CGEDHFLI
CDEFGHIK:CGEDHFIK
CDEFGHIJ:CGJDHFEI
BFGHIJKL:HJBFIGLK
BEGHIJKL:EJIBHGLK
BEFHIJKL:EJBFIHLK
BEFGIJKL:EJBFIGLK
BEFGHJKL:EJBFHGLK
BEFGHIKL:EGBFIHLK
BEFGHIJL:EJBFHGLI
BEFGHIJK:EJBFHGIK
BDGHIJKL:HJBDIGLK
BDFHIJKL:HJBDIFLK
BDFGIJKL:IGBDJFLK
BDFGHJKL:HGBDJFLK
BDFGHIKL:HGBDIFLK
BDFGHIJL:HGBDJFLI
BDFGHIJK:HGBDJFIK
BDEHIJKL:EJBDIHLK
BDEGIJKL:EJBDIGLK
BDEGHJKL:EJBDHGLK
BDEGHIKL:EGBDIHLK
BDEGHIJL:EJBDHGLI
BDEGHIJK:EJBDHGIK
BDEFIJKL:EJBDIFLK
BDEFHJKL:EJBDHFLK
BDEFHIKL:EIBDHFLK
BDEFHIJL:EJBDHFLI
BDEFHIJK:EJBDHFIK
BDEFGJKL:EGBDJFLK
BDEFGIKL:EGBDIFLK
BDEFGIJL:EGBDJFLI
BDEFGIJK:EGBDJFIK
BDEFGHKL:EGBDHFLK
BDEFGHJL:HGBDJFLE
BDEFGHJK:HGBDJFEK
BDEFGHIL:EGBDHFLI
BDEFGHIK:EGBDHFIK
BDEFGHIJ:HGBDJFEI
BCGHIJKL:HJBCIGLK
BCFHIJKL:HJBCIFLK
BCFGIJKL:IGBCJFLK
BCFGHJKL:HGBCJFLK
BCFGHIKL:HGBCIFLK
BCFGHIJL:HGBCJFLI
BCFGHIJK:HGBCJFIK
BCEHIJKL:EJBCIHLK
BCEGIJKL:EJBCIGLK
BCEGHJKL:EJBCHGLK
BCEGHIKL:EGBCIHLK
BCEGHIJL:EJBCHGLI
BCEGHIJK:EJBCHGIK
BCEFIJKL:EJBCIFLK
BCEFHJKL:EJBCHFLK
BCEFHIKL:EIBCHFLK
BCEFHIJL:EJBCHFLI
BCEFHIJK:EJBCHFIK
BCEFGJKL:EGBCJFLK
BCEFGIKL:EGBCIFLK
BCEFGIJL:EGBCJFLI
BCEFGIJK:EGBCJFIK
BCEFGHKL:EGBCHFLK
BCEFGHJL:HGBCJFLE
BCEFGHJK:HGBCJFEK
BCEFGHIL:EGBCHFLI
BCEFGHIK:EGBCHFIK
BCEFGHIJ:HGBCJFEI
BCDHIJKL:HJBCIDLK
BCDGIJKL:IGBCJDLK
BCDGHJKL:HGBCJDLK
BCDGHIKL:HGBCIDLK
BCDGHIJL:HGBCJDLI
BCDGHIJK:HGBCJDIK
BCDFIJKL:CJBDIFLK
BCDFHJKL:CJBDHFLK
BCDFHIKL:CIBDHFLK
BCDFHIJL:CJBDHFLI
BCDFHIJK:CJBDHFIK
BCDFGJKL:CGBDJFLK
BCDFGIKL:CGBDIFLK
BCDFGIJL:CGBDJFLI
BCDFGIJK:CGBDJFIK
BCDFGHKL:CGBDHFLK
BCDFGHJL:CGBDHFLJ
BCDFGHJK:HGBCJFDK
BCDFGHIL:CGBDHFLI
BCDFGHIK:CGBDHFIK
BCDFGHIJ:HGBCJFDI
BCDEIJKL:EJBCIDLK
BCDEHJKL:EJBCHDLK
BCDEHIKL:EIBCHDLK
BCDEHIJL:EJBCHDLI
BCDEHIJK:EJBCHDIK
BCDEGJKL:EGBCJDLK
BCDEGIKL:EGBCIDLK
BCDEGIJL:EGBCJDLI
BCDEGIJK:EGBCJDIK
BCDEGHKL:EGBCHDLK
BCDEGHJL:HGBCJDLE
BCDEGHJK:HGBCJDEK
BCDEGHIL:EGBCHDLI
BCDEGHIK:EGBCHDIK
BCDEGHIJ:HGBCJDEI
BCDEFJKL:CJBDEFLK
BCDEFIKL:CEBDIFLK
BCDEFIJL:CJBDEFLI
BCDEFIJK:CJBDEFIK
BCDEFHKL:CEBDHFLK
BCDEFHJL:CJBDHFLE
BCDEFHJK:CJBDHFEK
BCDEFHIL:CEBDHFLI
BCDEFHIK:CEBDHFIK
BCDEFHIJ:CJBDHFEI
BCDEFGKL:CGBDEFLK
BCDEFGJL:CGBDJFLE
BCDEFGJK:CGBDJFEK
BCDEFGIL:CGBDEFLI
BCDEFGIK:CGBDEFIK
BCDEFGIJ:CGBDJFEI
BCDEFGHL:CGBDHFLE
BCDEFGHK:CGBDHFEK
BCDEFGHJ:HGBCJFDE
BCDEFGHI:CGBDHFEI
AFGHIJKL:HJIFAGLK
AEGHIJKL:EJIAHGLK
AEFHIJKL:EJIFAHLK
AEFGIJKL:EJIFAGLK
AEFGHJKL:EGJFAHLK
AEFGHIKL:EGIFAHLK
AEFGHIJL:EGJFAHLI
AEFGHIJK:EGJFAHIK
ADGHIJKL:HJIDAGLK
ADFHIJKL:HJIDAFLK
ADFGIJKL:IGJDAFLK
ADFGHJKL:HGJDAFLK
ADFGHIKL:HGIDAFLK
ADFGHIJL:HGJDAFLI
ADFGHIJK:HGJDAFIK
ADEHIJKL:EJIDAHLK
ADEGIJKL:EJIDAGLK
ADEGHJKL:EGJDAHLK
ADEGHIKL:EGIDAHLK
ADEGHIJL:EGJDAHLI
ADEGHIJK:EGJDAHIK
ADEFIJKL:EJIDAFLK
ADEFHJKL:HJEDAFLK
ADEFHIKL:HEIDAFLK
ADEFHIJL:HJEDAFLI
ADEFHIJK:HJEDAFIK
ADEFGJKL:EGJDAFLK
ADEFGIKL:EGIDAFLK
ADEFGIJL:EGJDAFLI
ADEFGIJK:EGJDAFIK
ADEFGHKL:HGEDAFLK
ADEFGHJL:HGJDAFLE
ADEFGHJK:HGJDAFEK
ADEFGHIL:HGEDAFLI
ADEFGHIK:HGEDAFIK
ADEFGHIJ:HGJDAFEI
ACGHIJKL:HJICAGLK
ACFHIJKL:HJICAFLK
ACFGIJKL:IGJCAFLK
ACFGHJKL:HGJCAFLK
ACFGHIKL:HGICAFLK
ACFGHIJL:HGJCAFLI
ACFGHIJK:HGJCAFIK
ACEHIJKL:EJICAHLK
ACEGIJKL:EJICAGLK
ACEGHJKL:EGJCAHLK
ACEGHIKL:EGICAHLK
ACEGHIJL:EGJCAHLI
ACEGHIJK:EGJCAHIK
ACEFIJKL:EJICAFLK
ACEFHJKL:HJECAFLK
ACEFHIKL:HEICAFLK
ACEFHIJL:HJECAFLI
ACEFHIJK:HJECAFIK
ACEFGJKL:EGJCAFLK
ACEFGIKL:EGICAFLK
ACEFGIJL:EGJCAFLI
ACEFGIJK:EGJCAFIK
ACEFGHKL:HGECAFLK
ACEFGHJL:HGJCAFLE
ACEFGHJK:HGJCAFEK
ACEFGHIL:HGECAFLI
ACEFGHIK:HGECAFIK
ACEFGHIJ:HGJCAFEI
ACDHIJKL:HJICADLK
ACDGIJKL:IGJCADLK
ACDGHJKL:HGJCADLK
ACDGHIKL:HGICADLK
ACDGHIJL:HGJCADLI
ACDGHIJK:HGJCADIK
ACDFIJKL:CJIDAFLK
ACDFHJKL:HJFCADLK
ACDFHIKL:HFICADLK
ACDFHIJL:HJFCADLI
ACDFHIJK:HJFCADIK
ACDFGJKL:CGJDAFLK
ACDFGIKL:CGIDAFLK
ACDFGIJL:CGJDAFLI
ACDFGIJK:CGJDAFIK
ACDFGHKL:HGFCADLK
ACDFGHJL:CGJDAFLH
ACDFGHJK:HGJCAFDK
ACDFGHIL:HGFCADLI
ACDFGHIK:HGFCADIK
ACDFGHIJ:HGJCAFDI
ACDEIJKL:EJICADLK
ACDEHJKL:HJECADLK
ACDEHIKL:HEICADLK
ACDEHIJL:HJECADLI
ACDEHIJK:HJECADIK
ACDEGJKL:EGJCADLK
ACDEGIKL:EGICADLK
ACDEGIJL:EGJCADLI
ACDEGIJK:EGJCADIK
ACDEGHKL:HGECADLK
ACDEGHJL:HGJCADLE
ACDEGHJK:HGJCADEK
ACDEGHIL:HGECADLI
ACDEGHIK:HGECADIK
ACDEGHIJ:HGJCADEI
ACDEFJKL:CJEDAFLK
ACDEFIKL:CEIDAFLK
ACDEFIJL:CJEDAFLI
ACDEFIJK:CJEDAFIK
ACDEFHKL:HEFCADLK
ACDEFHJL:HJFCADLE
ACDEFHJK:HJECAFDK
ACDEFHIL:HEFCADLI
ACDEFHIK:HEFCADIK
ACDEFHIJ:HJECAFDI
ACDEFGKL:CGEDAFLK
ACDEFGJL:CGJDAFLE
ACDEFGJK:CGJDAFEK
ACDEFGIL:CGEDAFLI
ACDEFGIK:CGEDAFIK
ACDEFGIJ:CGJDAFEI
ACDEFGHL:HGFCADLE
ACDEFGHK:HGECAFDK
ACDEFGHJ:HGJCAFDE
ACDEFGHI:HGECAFDI
ABGHIJKL:HJBAIGLK
ABFHIJKL:HJBAIFLK
ABFGIJKL:IJBFAGLK
ABFGHJKL:HJBFAGLK
ABFGHIKL:HGBAIFLK
ABFGHIJL:HJBFAGLI
ABFGHIJK:HJBFAGIK
ABEHIJKL:EJBAIHLK
ABEGIJKL:EJBAIGLK
ABEGHJKL:EJBAHGLK
ABEGHIKL:EGBAIHLK
ABEGHIJL:EJBAHGLI
ABEGHIJK:EJBAHGIK
ABEFIJKL:EJBAIFLK
ABEFHJKL:EJBFAHLK
ABEFHIKL:EIBFAHLK
ABEFHIJL:EJBFAHLI
ABEFHIJK:EJBFAHIK
ABEFGJKL:EJBFAGLK
ABEFGIKL:EGBAIFLK
ABEFGIJL:EJBFAGLI
ABEFGIJK:EJBFAGIK
ABEFGHKL:EGBFAHLK
ABEFGHJL:HJBFAGLE
ABEFGHJK:HJBFAGEK
ABEFGHIL:EGBFAHLI
ABEFGHIK:EGBFAHIK
ABEFGHIJ:HJBFAGEI
ABDHIJKL:IJBDAHLK
ABDGIJKL:IJBDAGLK
ABDGHJKL:HJBDAGLK
ABDGHIKL:IGBDAHLK
ABDGHIJL:HJBDAGLI
ABDGHIJK:HJBDAGIK
ABDFIJKL:IJBDAFLK
ABDFHJKL:HJBDAFLK
ABDFHIKL:HIBDAFLK
ABDFHIJL:HJBDAFLI
ABDFHIJK:HJBDAFIK
ABDFGJKL:FJBDAGLK
ABDFGIKL:IGBDAFLK
ABDFGIJL:FJBDAGLI
ABDFGIJK:FJBDAGIK
ABDFGHKL:HGBDAFLK
ABDFGHJL:HGBDAFLJ
ABDFGHJK:HGBDAFJK
ABDFGHIL:HGBDAFLI
ABDFGHIK:HGBDAFIK
ABDFGHIJ:HGBDAFIJ
ABDEIJKL:EJBAIDLK
ABDEHJKL:EJBDAHLK
ABDEHIKL:EIBDAHLK
ABDEHIJL:EJBDAHLI
ABDEHIJK:EJBDAHIK
ABDEGJKL:EJBDAGLK
ABDEGIKL:EGBAIDLK
ABDEGIJL:EJBDAGLI
ABDEGIJK:EJBDAGIK
ABDEGHKL:EGBDAHLK
ABDEGHJL:HJBDAGLE
ABDEGHJK:HJBDAGEK
ABDEGHIL:EGBDAHLI
ABDEGHIK:EGBDAHIK
ABDEGHIJ:HJBDAGEI
ABDEFJKL:EJBDAFLK
ABDEFIKL:EIBDAFLK
ABDEFIJL:EJBDAFLI
ABDEFIJK:EJBDAFIK
ABDEFHKL:HEBDAFLK
ABDEFHJL:HJBDAFLE
ABDEFHJK:HJBDAFEK
ABDEFHIL:HEBDAFLI
ABDEFHIK:HEBDAFIK
ABDEFHIJ:HJBDAFEI
ABDEFGKL:EGBDAFLK
ABDEFGJL:EGBDAFLJ
ABDEFGJK:EGBDAFJK
ABDEFGIL:EGBDAFLI
ABDEFGIK:EGBDAFIK
ABDEFGIJ:EGBDAFIJ
ABDEFGHL:HGBDAFLE
ABDEFGHK:HGBDAFEK
ABDEFGHJ:HGBDAFEJ
ABDEFGHI:HGBDAFEI
ABCHIJKL:IJBCAHLK
ABCGIJKL:IJBCAGLK
ABCGHJKL:HJBCAGLK
ABCGHIKL:IGBCAHLK
ABCGHIJL:HJBCAGLI
ABCGHIJK:HJBCAGIK
ABCFIJKL:IJBCAFLK
ABCFHJKL:HJBCAFLK
ABCFHIKL:HIBCAFLK
ABCFHIJL:HJBCAFLI
ABCFHIJK:HJBCAFIK
ABCFGJKL:CJBFAGLK
ABCFGIKL:IGBCAFLK
ABCFGIJL:CJBFAGLI
ABCFGIJK:CJBFAGIK
ABCFGHKL:HGBCAFLK
ABCFGHJL:HGBCAFLJ
ABCFGHJK:HGBCAFJK
ABCFGHIL:HGBCAFLI
ABCFGHIK:HGBCAFIK
ABCFGHIJ:HGBCAFIJ
ABCEIJKL:EJBAICLK
ABCEHJKL:EJBCAHLK
ABCEHIKL:EIBCAHLK
ABCEHIJL:EJBCAHLI
ABCEHIJK:EJBCAHIK
ABCEGJKL:EJBCAGLK
ABCEGIKL:EGBAICLK
ABCEGIJL:EJBCAGLI
ABCEGIJK:EJBCAGIK
ABCEGHKL:EGBCAHLK
ABCEGHJL:HJBCAGLE
ABCEGHJK:HJBCAGEK
ABCEGHIL:EGBCAHLI
ABCEGHIK:EGBCAHIK
ABCEGHIJ:HJBCAGEI
ABCEFJKL:EJBCAFLK
ABCEFIKL:EIBCAFLK
ABCEFIJL:EJBCAFLI
ABCEFIJK:EJBCAFIK
ABCEFHKL:HEBCAFLK
ABCEFHJL:HJBCAFLE
ABCEFHJK:HJBCAFEK
ABCEFHIL:HEBCAFLI
ABCEFHIK:HEBCAFIK
ABCEFHIJ:HJBCAFEI
ABCEFGKL:EGBCAFLK
ABCEFGJL:EGBCAFLJ
ABCEFGJK:EGBCAFJK
ABCEFGIL:EGBCAFLI
ABCEFGIK:EGBCAFIK
ABCEFGIJ:EGBCAFIJ
ABCEFGHL:HGBCAFLE
ABCEFGHK:HGBCAFEK
ABCEFGHJ:HGBCAFEJ
ABCEFGHI:HGBCAFEI
ABCDIJKL:IJBCADLK
ABCDHJKL:HJBCADLK
ABCDHIKL:HIBCADLK
ABCDHIJL:HJBCADLI
ABCDHIJK:HJBCADIK
ABCDGJKL:CJBDAGLK
ABCDGIKL:IGBCADLK
ABCDGIJL:CJBDAGLI
ABCDGIJK:CJBDAGIK
ABCDGHKL:HGBCADLK
ABCDGHJL:HGBCADLJ
ABCDGHJK:HGBCADJK
ABCDGHIL:HGBCADLI
ABCDGHIK:HGBCADIK
ABCDGHIJ:HGBCADIJ
ABCDFJKL:CJBDAFLK
ABCDFIKL:CIBDAFLK
ABCDFIJL:CJBDAFLI
ABCDFIJK:CJBDAFIK
ABCDFHKL:HFBCADLK
ABCDFHJL:CJBDAFLH
ABCDFHJK:HJBCAFDK
ABCDFHIL:HFBCADLI
ABCDFHIK:HFBCADIK
ABCDFHIJ:HJBCAFDI
ABCDFGKL:CGBDAFLK
ABCDFGJL:CGBDAFLJ
ABCDFGJK:CGBDAFJK
ABCDFGIL:CGBDAFLI
ABCDFGIK:CGBDAFIK
ABCDFGIJ:CGBDAFIJ
ABCDFGHL:CGBDAFLH
ABCDFGHK:HGBCAFDK
ABCDFGHJ:HGBCAFDJ
ABCDFGHI:HGBCAFDI
ABCDEJKL:EJBCADLK
ABCDEIKL:EIBCADLK
ABCDEIJL:EJBCADLI
ABCDEIJK:EJBCADIK
ABCDEHKL:HEBCADLK
ABCDEHJL:HJBCADLE
ABCDEHJK:HJBCADEK
ABCDEHIL:HEBCADLI
ABCDEHIK:HEBCADIK
ABCDEHIJ:HJBCADEI
ABCDEGKL:EGBCADLK
ABCDEGJL:EGBCADLJ
ABCDEGJK:EGBCADJK
ABCDEGIL:EGBCADLI
ABCDEGIK:EGBCADIK
ABCDEGIJ:EGBCADIJ
ABCDEGHL:HGBCADLE
ABCDEGHK:HGBCADEK
ABCDEGHJ:HGBCADEJ
ABCDEGHI:HGBCADEI
ABCDEFKL:CEBDAFLK
ABCDEFJL:CJBDAFLE
ABCDEFJK:CJBDAFEK
ABCDEFIL:CEBDAFLI
ABCDEFIK:CEBDAFIK
ABCDEFIJ:CJBDAFEI
ABCDEFHL:HFBCADLE
ABCDEFHK:HEBCAFDK
ABCDEFHJ:HJBCAFDE
ABCDEFHI:HEBCAFDI
ABCDEFGL:CGBDAFLE
ABCDEFGK:CGBDAFEK
ABCDEFGJ:CGBDAFEJ
ABCDEFGI:CGBDAFEI
ABCDEFGH:HGBCAFDE
`;

  const THIRD_PLACE_ASSIGNMENTS = parseThirdPlaceAssignments(THIRD_PLACE_ASSIGNMENTS_RAW);

  function match(id, round, source1, source2) {
    return {id, round, label: id, sources: [source1, source2]};
  }

  function pos(group, rank) {
    return {kind: 'position', group, rank, label: `${rank}${group}`};
  }

  function third(winnerGroup, candidates) {
    return {
      kind: 'third',
      winnerGroup,
      candidates: candidates.split(''),
      label: `3${candidates}`,
    };
  }

  function winner(matchId) {
    return {kind: 'winner', matchId, label: `W${matchId.slice(1)}`};
  }

  function parseThirdPlaceAssignments(raw) {
    const out = {};
    raw.trim().split(/\s+/).forEach(line => {
      const [key, values] = line.split(':');
      if (!key || !values || values.length !== THIRD_PLACE_COLUMNS.length) return;
      out[key] = Object.fromEntries(THIRD_PLACE_COLUMNS.map((column, index) => [column, values[index]]));
    });
    return out;
  }

  function createEmptyGroupPredictions() {
    return Object.fromEntries(GROUP_ORDER.map(group => [group, Array.from({length: 6}, () => ({homeGoals: null, awayGoals: null}))]));
  }

  function isScoreComplete(score) {
    return score && Number.isInteger(score.homeGoals) && Number.isInteger(score.awayGoals) && score.homeGoals >= 0 && score.awayGoals >= 0;
  }

  function sanitizeScoreValue(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 99) return null;
    return number;
  }

  function normalizeScore(score) {
    if (!score || typeof score !== 'object') return {homeGoals: null, awayGoals: null};
    return {
      homeGoals: sanitizeScoreValue(score.homeGoals),
      awayGoals: sanitizeScoreValue(score.awayGoals),
    };
  }

  function normalizeGroupPredictions(input) {
    const out = createEmptyGroupPredictions();
    if (!input || typeof input !== 'object') return out;
    GROUP_ORDER.forEach(group => {
      const source = Array.isArray(input[group]) ? input[group] : [];
      out[group] = out[group].map((_, index) => normalizeScore(source[index]));
    });
    return out;
  }

  function resultFromScore(homeGoals, awayGoals) {
    if (homeGoals > awayGoals) return '1';
    if (awayGoals > homeGoals) return '2';
    return 'x';
  }

  function resultFromPrediction(score) {
    if (score === '1' || score === 'x' || score === '2') return score;
    if (!isScoreComplete(score)) return null;
    return resultFromScore(score.homeGoals, score.awayGoals);
  }

  function buildGroupStandings(group, predictions = []) {
    const teams = GROUPS[group]?.teams || [];
    const rowsById = Object.fromEntries(teams.map(team => [team.id, {
      teamId: team.id,
      team,
      group,
      played: 0,
      points: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      fallbackRank: team.fallbackRank,
    }]));

    (GROUP_FIXTURES[group] || []).forEach((fixture, index) => {
      const score = normalizeScore(predictions[index]);
      if (!isScoreComplete(score)) return;
      const home = rowsById[fixture.homeId];
      const away = rowsById[fixture.awayId];
      home.played += 1;
      away.played += 1;
      home.gf += score.homeGoals;
      home.ga += score.awayGoals;
      away.gf += score.awayGoals;
      away.ga += score.homeGoals;
      if (score.homeGoals > score.awayGoals) home.points += 3;
      else if (score.awayGoals > score.homeGoals) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    });

    Object.values(rowsById).forEach(row => { row.gd = row.gf - row.ga; });
    return rankGroupRows(Object.values(rowsById), group, predictions);
  }

  function rankGroupRows(rows, group, predictions = []) {
    const byPoints = new Map();
    rows.forEach(row => {
      const key = row.points;
      if (!byPoints.has(key)) byPoints.set(key, []);
      byPoints.get(key).push(row);
    });
    const pointGroups = Array.from(byPoints.keys()).sort((a, b) => b - a);
    return pointGroups.flatMap(points => rankTieGroup(byPoints.get(points), group, predictions));
  }

  function rankTieGroup(rows, group, predictions = []) {
    if (rows.length <= 1) return rows;
    const ids = new Set(rows.map(row => row.teamId));
    const h2h = Object.fromEntries(rows.map(row => [row.teamId, {points: 0, gf: 0, ga: 0, gd: 0}]));
    (GROUP_FIXTURES[group] || []).forEach((fixture, index) => {
      if (!ids.has(fixture.homeId) || !ids.has(fixture.awayId)) return;
      const score = normalizeScore(predictions[index]);
      if (!isScoreComplete(score)) return;
      const home = h2h[fixture.homeId];
      const away = h2h[fixture.awayId];
      home.gf += score.homeGoals;
      home.ga += score.awayGoals;
      away.gf += score.awayGoals;
      away.ga += score.homeGoals;
      if (score.homeGoals > score.awayGoals) home.points += 3;
      else if (score.awayGoals > score.homeGoals) away.points += 3;
      else {
        home.points += 1;
        away.points += 1;
      }
    });
    Object.values(h2h).forEach(row => { row.gd = row.gf - row.ga; });
    return [...rows].sort((a, b) => (
      h2h[b.teamId].points - h2h[a.teamId].points ||
      h2h[b.teamId].gd - h2h[a.teamId].gd ||
      h2h[b.teamId].gf - h2h[a.teamId].gf ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.fallbackRank - b.fallbackRank
    ));
  }

  function buildAllGroupStandings(groupPredictions = {}) {
    const normalized = normalizeGroupPredictions(groupPredictions);
    return Object.fromEntries(GROUP_ORDER.map(group => [group, buildGroupStandings(group, normalized[group])]));
  }

  function rankThirdPlaced(standingsByGroup) {
    return GROUP_ORDER.map(group => {
      const row = standingsByGroup[group]?.[2];
      return row ? {...row, thirdGroup: group} : null;
    }).filter(Boolean).sort((a, b) => (
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.fallbackRank - b.fallbackRank
    ));
  }

  function getThirdPlaceAssignments(thirdGroups) {
    const key = [...new Set(thirdGroups)].sort().join('');
    return THIRD_PLACE_ASSIGNMENTS[key] || null;
  }

  function resolveTournamentSlots(groupPredictions = {}) {
    const standingsByGroup = buildAllGroupStandings(groupPredictions);
    const thirdRank = rankThirdPlaced(standingsByGroup);
    const qualifiedThirdGroups = thirdRank.slice(0, 8).map(row => row.thirdGroup);
    const thirdAssignments = getThirdPlaceAssignments(qualifiedThirdGroups) || {};

    const slots = {};
    ROUND_OF_32.forEach(matchItem => {
      slots[matchItem.id] = matchItem.sources.map(source => resolveSource(source, standingsByGroup, thirdAssignments));
    });

    return {standingsByGroup, thirdRank, qualifiedThirdGroups, thirdAssignments, slots};
  }

  function resolveBracketMatches(groupPredictions = {}, bracketWinners = {}) {
    const tournament = resolveTournamentSlots(groupPredictions);
    const matches = {};
    BRACKET_MATCHES.forEach(matchItem => {
      const slots = matchItem.round === 'r32'
        ? tournament.slots[matchItem.id]
        : matchItem.sources.map(source => resolveWinnerSource(source, bracketWinners));
      matches[matchItem.id] = {...matchItem, slots};
    });
    return {...tournament, matches};
  }

  function resolveSource(source, standingsByGroup, thirdAssignments) {
    if (source.kind === 'position') {
      const row = standingsByGroup[source.group]?.[source.rank - 1];
      return row ? row.teamId : null;
    }
    if (source.kind === 'third') {
      const assignedGroup = thirdAssignments[source.winnerGroup];
      if (!assignedGroup || !source.candidates.includes(assignedGroup)) return null;
      const row = standingsByGroup[assignedGroup]?.[2];
      return row ? row.teamId : null;
    }
    return null;
  }

  function resolveWinnerSource(source, bracketWinners) {
    if (source.kind !== 'winner') return null;
    return bracketWinners?.[source.matchId] || null;
  }

  function getTeamName(teamId) {
    return TEAMS[teamId]?.name || teamId || '';
  }

  function getTeamFlag(teamId) {
    return TEAMS[teamId]?.flag || '';
  }

  const TEAM_ISO = {
    'mexico': 'mx',
    'south-africa': 'za',
    'south-korea': 'kr',
    'czech-republic': 'cz',
    'canada': 'ca',
    'bosnia-herzegovina': 'ba',
    'qatar': 'qa',
    'switzerland': 'ch',
    'brazil': 'br',
    'morocco': 'ma',
    'haiti': 'ht',
    'scotland': 'gb-sct',
    'usa': 'us',
    'paraguay': 'py',
    'australia': 'au',
    'turkey': 'tr',
    'germany': 'de',
    'curacao': 'cw',
    'ivory-coast': 'ci',
    'ecuador': 'ec',
    'netherlands': 'nl',
    'japan': 'jp',
    'sweden': 'se',
    'tunisia': 'tn',
    'belgium': 'be',
    'egypt': 'eg',
    'iran': 'ir',
    'new-zealand': 'nz',
    'spain': 'es',
    'cape-verde': 'cv',
    'saudi-arabia': 'sa',
    'uruguay': 'uy',
    'france': 'fr',
    'senegal': 'sn',
    'iraq': 'iq',
    'norway': 'no',
    'argentina': 'ar',
    'algeria': 'dz',
    'austria': 'at',
    'jordan': 'jo',
    'portugal': 'pt',
    'dr-congo': 'cd',
    'uzbekistan': 'uz',
    'colombia': 'co',
    'england': 'gb-eng',
    'croatia': 'hr',
    'ghana': 'gh',
    'panama': 'pa',
  };

  const FLAG_CDN_BASE = 'https://flagcdn.com';

  function getTeamFlagImgUrl(teamId, width = 80) {
    const iso = TEAM_ISO[teamId];
    if (!iso) return '';
    return `${FLAG_CDN_BASE}/w${width}/${iso}.png`;
  }

  function getTeamFlagImg(teamId, options = {}) {
    const url = getTeamFlagImgUrl(teamId, options.width || 80);
    if (!url) return TEAMS[teamId]?.flag || '';
    const name = TEAMS[teamId]?.name || teamId;
    const cls = options.className ? ` class="${options.className}"` : '';
    const srcset = `${getTeamFlagImgUrl(teamId, 160)} 2x, ${getTeamFlagImgUrl(teamId, 320)} 4x`;
    return `<img src="${url}" srcset="${srcset}" alt="${name}" loading="lazy" decoding="async"${cls}>`;
  }

  function normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const FIXTURES = {
    GROUP_ORDER,
    GROUPS,
    TEAMS,
    TEAM_IDS,
    ALL_TEAMS,
    ALL_TEAM_NAMES,
    GROUP_FIXTURES,
    ROUND_OF_32,
    NEXT_ROUNDS,
    BRACKET_MATCHES,
    BRACKET_BY_ROUND,
    THIRD_PLACE_ASSIGNMENTS,
    THIRD_PLACE_COLUMNS,
    createEmptyGroupPredictions,
    normalizeGroupPredictions,
    normalizeScore,
    sanitizeScoreValue,
    isScoreComplete,
    resultFromScore,
    resultFromPrediction,
    buildGroupStandings,
    buildAllGroupStandings,
    rankThirdPlaced,
    getThirdPlaceAssignments,
    resolveTournamentSlots,
    resolveBracketMatches,
    getTeamName,
    getTeamFlag,
    getTeamFlagImg,
    getTeamFlagImgUrl,
    TEAM_ISO,
    normalizeName,
    R32: ROUND_OF_32,
    R16: BRACKET_BY_ROUND.r16,
    QF: BRACKET_BY_ROUND.qf,
    SF: BRACKET_BY_ROUND.sf,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FIXTURES;
  } else {
    Object.assign(scope, FIXTURES);
  }
})(typeof window !== 'undefined' ? window : globalThis);
