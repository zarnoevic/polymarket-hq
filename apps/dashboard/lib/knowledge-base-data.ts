/**
 * Knowledge base sources for geopolitical theater analysis.
 * Information wars: Ukrainian war, Iran/Middle East, Taiwan/China.
 */
export type SourceType = "wikipedia" | "book";

export type KnowledgeSource = {
  id: string;
  title: string;
  type: SourceType;
  url?: string;
  author?: string;
  year?: string;
  theater: "iranian" | "russian" | "chinese";
  category: string;
};

function wp(path: string): string {
  return `https://en.wikipedia.org/wiki/${path}`;
}

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  // ═══════════════════════════════════════════════════════════════
  // IRANIAN THEATER
  // ═══════════════════════════════════════════════════════════════
  { id: "ir-1", title: "1953 Iranian coup d'état", type: "wikipedia", url: wp("1953_Iranian_coup_d%27%C3%A9tat"), theater: "iranian", category: "Pre-Revolution" },
  { id: "ir-2", title: "Mohammad Mosaddegh", type: "wikipedia", url: wp("Mohammad_Mosaddegh"), theater: "iranian", category: "Pre-Revolution" },
  { id: "ir-3", title: "Iranian Revolution", type: "wikipedia", url: wp("Iranian_Revolution"), theater: "iranian", category: "Revolution" },
  { id: "ir-4", title: "Ruhollah Khomeini", type: "wikipedia", url: wp("Ruhollah_Khomeini"), theater: "iranian", category: "Revolution" },
  { id: "ir-5", title: "Iran hostage crisis", type: "wikipedia", url: wp("Iran_hostage_crisis"), theater: "iranian", category: "Revolution" },
  { id: "ir-6", title: "Iran–Iraq War", type: "wikipedia", url: wp("Iran%E2%80%93Iraq_War"), theater: "iranian", category: "Iran-Iraq War" },
  { id: "ir-7", title: "Saddam Hussein", type: "wikipedia", url: wp("Saddam_Hussein"), theater: "iranian", category: "Iran-Iraq War" },
  { id: "ir-8", title: "Chemical weapons in the Iran–Iraq War", type: "wikipedia", url: wp("Chemical_weapons_in_the_Iran%E2%80%93Iraq_War"), theater: "iranian", category: "Iran-Iraq War" },
  { id: "ir-9", title: "Iraq War", type: "wikipedia", url: wp("Iraq_War"), theater: "iranian", category: "Iraq War" },
  { id: "ir-10", title: "2003 invasion of Iraq", type: "wikipedia", url: wp("2003_invasion_of_Iraq"), theater: "iranian", category: "Iraq War" },
  { id: "ir-11", title: "Gulf War", type: "wikipedia", url: wp("Gulf_War"), theater: "iranian", category: "Gulf Wars" },
  { id: "ir-12", title: "Iran–Saudi Arabia proxy conflict", type: "wikipedia", url: wp("Iran%E2%80%93Saudi_Arabia_proxy_conflict"), theater: "iranian", category: "Regional" },
  { id: "ir-13", title: "Saudi Arabia–Iran relations", type: "wikipedia", url: wp("Saudi_Arabia%E2%80%93Iran_relations"), theater: "iranian", category: "Regional" },
  { id: "ir-14", title: "Iran nuclear deal", type: "wikipedia", url: wp("Joint_Comprehensive_Plan_of_Action"), theater: "iranian", category: "Nuclear" },
  { id: "ir-15", title: "Iran–Israel conflict", type: "wikipedia", url: wp("Iran%E2%80%93Israel_conflict"), theater: "iranian", category: "Israel" },
  { id: "ir-16", title: "Islamic Revolutionary Guard Corps", type: "wikipedia", url: wp("Islamic_Revolutionary_Guard_Corps"), theater: "iranian", category: "Military" },
  { id: "ir-17", title: "Iranian involvement in the Syrian civil war", type: "wikipedia", url: wp("Iranian_involvement_in_the_Syrian_civil_war"), theater: "iranian", category: "Proxy Wars" },
  { id: "ir-18", title: "Iranian support for Houthis in Yemen", type: "wikipedia", url: wp("Yemeni_Civil_War_(2014%E2%80%93present)"), theater: "iranian", category: "Proxy Wars" },
  { id: "ir-19", title: "Hezbollah", type: "wikipedia", url: wp("Hezbollah"), theater: "iranian", category: "Proxy Wars" },
  { id: "ir-20", title: "History of Iran", type: "wikipedia", url: wp("History_of_Iran"), theater: "iranian", category: "Background" },
  { id: "ir-21", title: "All the Shah's Men", type: "book", author: "Stephen Kinzer", year: "2003", theater: "iranian", category: "Pre-Revolution" },
  { id: "ir-22", title: "The Persian Puzzle", type: "book", author: "Kenneth M. Pollack", year: "2004", theater: "iranian", category: "Background" },
  { id: "ir-23", title: "The Tragedy of Great Power Politics", type: "book", author: "John Mearsheimer", year: "2001", theater: "iranian", category: "Theory" },
  { id: "ir-24", title: "From the Shadows", type: "book", author: "Robert M. Gates", year: "1996", theater: "iranian", category: "Cold War" },
  { id: "ir-25", title: "The Grand Chessboard", type: "book", author: "Zbigniew Brzezinski", year: "1997", theater: "iranian", category: "Geopolitics" },
  { id: "ir-26", title: "The Iran-Iraq War", type: "book", author: "Williamson Murray & Kevin M. Woods", year: "2014", theater: "iranian", category: "Iran-Iraq War" },
  { id: "ir-27", title: "Fiasco: The American Military Adventure in Iraq", type: "book", author: "Thomas E. Ricks", year: "2006", theater: "iranian", category: "Iraq War" },
  { id: "ir-28", title: "The Gamble", type: "book", author: "Thomas E. Ricks", year: "2009", theater: "iranian", category: "Iraq War" },
  { id: "ir-29", title: "Obama's Wars", type: "book", author: "Bob Woodward", year: "2010", theater: "iranian", category: "Iraq War" },
  { id: "ir-30", title: "Iran–United States relations", type: "wikipedia", url: wp("Iran%E2%80%93United_States_relations"), theater: "iranian", category: "Background" },
  { id: "ir-31", title: "Persian Gulf", type: "wikipedia", url: wp("Persian_Gulf"), theater: "iranian", category: "Regional" },
  { id: "ir-32", title: "Qasem Soleimani", type: "wikipedia", url: wp("Qasem_Soleimani"), theater: "iranian", category: "Military" },
  { id: "ir-33", title: "Mujahedin-e-Khalq", type: "wikipedia", url: wp("People%27s_Mujahedin_of_Iran"), theater: "iranian", category: "Background" },
  { id: "ir-34", title: "Iranian Kurdistan", type: "wikipedia", url: wp("Iranian_Kurdistan"), theater: "iranian", category: "Regional" },
  { id: "ir-35", title: "Reform movement in Iran", type: "wikipedia", url: wp("2nd_Khordad_Front"), theater: "iranian", category: "Revolution" },
  { id: "ir-36", title: "The Reign of the Ayatollahs", type: "book", author: "Shaul Bakhash", year: "1984", theater: "iranian", category: "Revolution" },
  { id: "ir-37", title: "The Ayatollah Begs to Differ", type: "book", author: "Hooman Majd", year: "2008", theater: "iranian", category: "Background" },
  { id: "ir-38", title: "The Iran Wars", type: "book", author: "Jay Solomon", year: "2016", theater: "iranian", category: "Nuclear" },
  // ═══════════════════════════════════════════════════════════════
  // RUSSIAN THEATER
  // ═══════════════════════════════════════════════════════════════
  { id: "ru-1", title: "Eastern Front (World War II)", type: "wikipedia", url: wp("Eastern_Front_(World_War_II)"), theater: "russian", category: "WW2" },
  { id: "ru-2", title: "Operation Barbarossa", type: "wikipedia", url: wp("Operation_Barbarossa"), theater: "russian", category: "WW2" },
  { id: "ru-3", title: "Battle of Stalingrad", type: "wikipedia", url: wp("Battle_of_Stalingrad"), theater: "russian", category: "WW2" },
  { id: "ru-4", title: "Siege of Leningrad", type: "wikipedia", url: wp("Siege_of_Leningrad"), theater: "russian", category: "WW2" },
  { id: "ru-5", title: "Soviet Union in World War II", type: "wikipedia", url: wp("Soviet_Union_in_World_War_II"), theater: "russian", category: "WW2" },
  { id: "ru-6", title: "Cold War", type: "wikipedia", url: wp("Cold_War"), theater: "russian", category: "Cold War" },
  { id: "ru-7", title: "Soviet–Afghan War", type: "wikipedia", url: wp("Soviet%E2%80%93Afghan_War"), theater: "russian", category: "Cold War" },
  { id: "ru-8", title: "Dissolution of the Soviet Union", type: "wikipedia", url: wp("Dissolution_of_the_Soviet_Union"), theater: "russian", category: "Cold War" },
  { id: "ru-9", title: "Russo-Ukrainian War", type: "wikipedia", url: wp("Russo-Ukrainian_War"), theater: "russian", category: "Ukraine" },
  { id: "ru-10", title: "Russian invasion of Ukraine", type: "wikipedia", url: wp("Russian_invasion_of_Ukraine"), theater: "russian", category: "Ukraine" },
  { id: "ru-11", title: "Annexation of Crimea by the Russian Federation", type: "wikipedia", url: wp("Annexation_of_Crimea_by_the_Russian_Federation"), theater: "russian", category: "Ukraine" },
  { id: "ru-12", title: "War in Donbas (2014–2022)", type: "wikipedia", url: wp("War_in_Donbas_(2014%E2%80%932022)"), theater: "russian", category: "Ukraine" },
  { id: "ru-13", title: "Russian information warfare", type: "wikipedia", url: wp("Russian_information_warfare"), theater: "russian", category: "Information War" },
  { id: "ru-14", title: "Internet Research Agency", type: "wikipedia", url: wp("Internet_Research_Agency"), theater: "russian", category: "Information War" },
  { id: "ru-15", title: "RT (TV network)", type: "wikipedia", url: wp("RT_(TV_network)"), theater: "russian", category: "Information War" },
  { id: "ru-16", title: "Chechen Wars", type: "wikipedia", url: wp("Chechen_Wars"), theater: "russian", category: "Post-Soviet" },
  { id: "ru-17", title: "Russo-Georgian War", type: "wikipedia", url: wp("Russo-Georgian_War"), theater: "russian", category: "Post-Soviet" },
  { id: "ru-18", title: "Vladimir Putin", type: "wikipedia", url: wp("Vladimir_Putin"), theater: "russian", category: "Leaders" },
  { id: "ru-19", title: "History of Russia", type: "wikipedia", url: wp("History_of_Russia"), theater: "russian", category: "Background" },
  { id: "ru-20", title: "The Gates of Europe", type: "book", author: "Serhii Plokhy", year: "2015", theater: "russian", category: "Ukraine" },
  { id: "ru-21", title: "The Grand Chessboard", type: "book", author: "Zbigniew Brzezinski", year: "1997", theater: "russian", category: "Geopolitics" },
  { id: "ru-22", title: "The New Cold War", type: "book", author: "Edward Lucas", year: "2008", theater: "russian", category: "Cold War" },
  { id: "ru-23", title: "LikeWar: The Weaponization of Social Media", type: "book", author: "P.W. Singer & Emerson Brooking", year: "2018", theater: "russian", category: "Information War" },
  { id: "ru-24", title: "Active Measures", type: "book", author: "Thomas Rid", year: "2020", theater: "russian", category: "Information War" },
  { id: "ru-25", title: "The Russo-Ukrainian War", type: "book", author: "Serhii Plokhy", year: "2023", theater: "russian", category: "Ukraine" },
  { id: "ru-26", title: "Stalin: Waiting for Hitler, 1929–1941", type: "book", author: "Stephen Kotkin", year: "2017", theater: "russian", category: "WW2" },
  { id: "ru-27", title: "Iron Curtain", type: "book", author: "Anne Applebaum", year: "2012", theater: "russian", category: "Cold War" },
  { id: "ru-28", title: "The Gulag Archipelago", type: "book", author: "Aleksandr Solzhenitsyn", year: "1973", theater: "russian", category: "Background" },
  { id: "ru-29", title: "Secondhand Time", type: "book", author: "Svetlana Alexievich", year: "2013", theater: "russian", category: "Post-Soviet" },
  // ═══════════════════════════════════════════════════════════════
  // CHINESE THEATER
  // ═══════════════════════════════════════════════════════════════
  { id: "ch-1", title: "First Opium War", type: "wikipedia", url: wp("First_Opium_War"), theater: "chinese", category: "Opium Wars" },
  { id: "ch-2", title: "Second Opium War", type: "wikipedia", url: wp("Second_Opium_War"), theater: "chinese", category: "Opium Wars" },
  { id: "ch-3", title: "Treaty of Nanking", type: "wikipedia", url: wp("Treaty_of_Nanking"), theater: "chinese", category: "Opium Wars" },
  { id: "ch-4", title: "Chinese Civil War", type: "wikipedia", url: wp("Chinese_Civil_War"), theater: "chinese", category: "Civil War" },
  { id: "ch-5", title: "Kuomintang", type: "wikipedia", url: wp("Kuomintang"), theater: "chinese", category: "Civil War" },
  { id: "ch-6", title: "Chinese Communist Party", type: "wikipedia", url: wp("Chinese_Communist_Party"), theater: "chinese", category: "Civil War" },
  { id: "ch-7", title: "Second Sino-Japanese War", type: "wikipedia", url: wp("Second_Sino-Japanese_War"), theater: "chinese", category: "Sino-Japanese" },
  { id: "ch-8", title: "Taiwan", type: "wikipedia", url: wp("Taiwan"), theater: "chinese", category: "Taiwan" },
  { id: "ch-9", title: "Political status of Taiwan", type: "wikipedia", url: wp("Political_status_of_Taiwan"), theater: "chinese", category: "Taiwan" },
  { id: "ch-10", title: "Taiwan Straits Crises", type: "wikipedia", url: wp("First_Taiwan_Strait_Crisis"), theater: "chinese", category: "Taiwan" },
  { id: "ch-11", title: "1996 Taiwan Strait crisis", type: "wikipedia", url: wp("1996_Taiwan_Strait_crisis"), theater: "chinese", category: "Taiwan" },
  { id: "ch-12", title: "Cross-Strait relations", type: "wikipedia", url: wp("Cross-Strait_relations"), theater: "chinese", category: "Taiwan" },
  { id: "ch-13", title: "Cultural Revolution", type: "wikipedia", url: wp("Cultural_Revolution"), theater: "chinese", category: "Mao Era" },
  { id: "ch-14", title: "Tiananmen Square protests of 1989", type: "wikipedia", url: wp("Tiananmen_Square_protests_of_1989"), theater: "chinese", category: "Modern" },
  { id: "ch-15", title: "Hong Kong", type: "wikipedia", url: wp("Hong_Kong"), theater: "chinese", category: "Hong Kong" },
  { id: "ch-16", title: "2019–2020 Hong Kong protests", type: "wikipedia", url: wp("2019%E2%80%932020_Hong_Kong_protests"), theater: "chinese", category: "Hong Kong" },
  { id: "ch-17", title: "South China Sea dispute", type: "wikipedia", url: wp("Territorial_disputes_in_the_South_China_Sea"), theater: "chinese", category: "Regional" },
  { id: "ch-18", title: "Belt and Road Initiative", type: "wikipedia", url: wp("Belt_and_Road_Initiative"), theater: "chinese", category: "Modern" },
  { id: "ch-19", title: "Xinjiang conflict", type: "wikipedia", url: wp("Xinjiang_conflict"), theater: "chinese", category: "Regional" },
  { id: "ch-20", title: "History of China", type: "wikipedia", url: wp("History_of_China"), theater: "chinese", category: "Background" },
  { id: "ch-21", title: "The Opium War", type: "book", author: "Julia Lovell", year: "2011", theater: "chinese", category: "Opium Wars" },
  { id: "ch-22", title: "The Tragedy of Liberation", type: "book", author: "Frank Dikötter", year: "2013", theater: "chinese", category: "Civil War" },
  { id: "ch-23", title: "Mao's Great Famine", type: "book", author: "Frank Dikötter", year: "2010", theater: "chinese", category: "Mao Era" },
  { id: "ch-24", title: "The Party", type: "book", author: "Richard McGregor", year: "2010", theater: "chinese", category: "Modern" },
  { id: "ch-25", title: "The Hundred-Year Marathon", type: "book", author: "Michael Pillsbury", year: "2015", theater: "chinese", category: "Modern" },
  { id: "ch-26", title: "Destined for War", type: "book", author: "Graham Allison", year: "2017", theater: "chinese", category: "Geopolitics" },
  { id: "ch-27", title: "The World Until Yesterday", type: "book", author: "Jared Diamond", year: "2012", theater: "chinese", category: "Background" },
  { id: "ch-28", title: "China's Good War", type: "book", author: "Rana Mitter", year: "2020", theater: "chinese", category: "WW2 Memory" },
  { id: "ch-29", title: "Forgotten Ally", type: "book", author: "Rana Mitter", year: "2013", theater: "chinese", category: "Sino-Japanese" },
  { id: "ch-30", title: "Has the West Lost It?", type: "book", author: "Kishore Mahbubani", year: "2018", theater: "chinese", category: "Geopolitics" },
  { id: "ch-31", title: "Unequal Treaties (China)", type: "wikipedia", url: wp("Unequal_treaty"), theater: "chinese", category: "Opium Wars" },
  { id: "ch-32", title: "Qing dynasty", type: "wikipedia", url: wp("Qing_dynasty"), theater: "chinese", category: "Background" },
  { id: "ch-33", title: "Tibet", type: "wikipedia", url: wp("Tibet"), theater: "chinese", category: "Regional" },
  { id: "ch-34", title: "Sino-Soviet split", type: "wikipedia", url: wp("Sino-Soviet_split"), theater: "chinese", category: "Cold War" },
  { id: "ch-35", title: "People's Liberation Army", type: "wikipedia", url: wp("People%27s_Liberation_Army"), theater: "chinese", category: "Military" },
  { id: "ch-36", title: "Chinese information operations", type: "wikipedia", url: wp("United_Front_Work_Department"), theater: "chinese", category: "Information War" },
  { id: "ir-39", title: "Persian Empire", type: "wikipedia", url: wp("Achaemenid_Empire"), theater: "iranian", category: "Background" },
  { id: "ir-40", title: "Iranian Green Movement", type: "wikipedia", url: wp("2009_Iranian_presidential_election_protests"), theater: "iranian", category: "Modern" },
  { id: "ir-41", title: "2022–2023 Iranian protests", type: "wikipedia", url: wp("Mahsa_Amini_protests"), theater: "iranian", category: "Modern" },
  { id: "ir-42", title: "Quds Force", type: "wikipedia", url: wp("Quds_Force"), theater: "iranian", category: "Military" },
  { id: "ir-43", title: "Iran and the War on Terror", type: "wikipedia", url: wp("Iran%E2%80%93United_States_relations"), theater: "iranian", category: "US Relations" },
  { id: "ru-30", title: "Molotov–Ribbentrop Pact", type: "wikipedia", url: wp("Molotov%E2%80%93Ribbentrop_Pact"), theater: "russian", category: "WW2" },
  { id: "ru-31", title: "Warsaw Pact", type: "wikipedia", url: wp("Warsaw_Pact"), theater: "russian", category: "Cold War" },
  { id: "ru-32", title: "NATO", type: "wikipedia", url: wp("NATO"), theater: "russian", category: "Cold War" },
  { id: "ru-33", title: "Propaganda in the Soviet Union", type: "wikipedia", url: wp("Propaganda_in_the_Soviet_Union"), theater: "russian", category: "Information War" },
  { id: "ru-34", title: "Disinformation in the 2016 United States elections", type: "wikipedia", url: wp("Disinformation_in_the_2016_United_States_elections"), theater: "russian", category: "Information War" },
  { id: "ru-35", title: "Battle of Kursk", type: "wikipedia", url: wp("Battle_of_Kursk"), theater: "russian", category: "WW2" },
  { id: "ru-36", title: "Holodomor", type: "wikipedia", url: wp("Holodomor"), theater: "russian", category: "Background" },
  { id: "ru-37", title: "Joseph Stalin", type: "wikipedia", url: wp("Joseph_Stalin"), theater: "russian", category: "WW2" },
  { id: "ru-38", title: "Wagner Group", type: "wikipedia", url: wp("Wagner_Group"), theater: "russian", category: "Ukraine" },
  { id: "ru-39", title: "Bloodlands", type: "book", author: "Timothy Snyder", year: "2010", theater: "russian", category: "WW2" },
  { id: "ru-40", title: "The Road to Unfreedom", type: "book", author: "Timothy Snyder", year: "2018", theater: "russian", category: "Information War" },
  { id: "ir-44", title: "Shia–Sunni relations", type: "wikipedia", url: wp("Shia%E2%80%93Sunni_relations"), theater: "iranian", category: "Background" },
  { id: "ir-45", title: "Pahlavi dynasty", type: "wikipedia", url: wp("Pahlavi_dynasty"), theater: "iranian", category: "Pre-Revolution" },
  { id: "ir-46", title: "Persian Constitutional Revolution", type: "wikipedia", url: wp("Persian_Constitutional_Revolution"), theater: "iranian", category: "Background" },
  { id: "ir-47", title: "Cobra II", type: "book", author: "Michael R. Gordon & Bernard E. Trainor", year: "2006", theater: "iranian", category: "Iraq War" },
  { id: "ir-48", title: "The Looming Tower", type: "book", author: "Lawrence Wright", year: "2006", theater: "iranian", category: "Background" },
  { id: "ir-49", title: "Operation Praying Mantis", type: "wikipedia", url: wp("Operation_Praying_Mantis"), theater: "iranian", category: "Gulf Wars" },
  { id: "ir-50", title: "Bridgeton incident", type: "wikipedia", url: wp("Bridgeton_incident"), theater: "iranian", category: "Gulf Wars" },
  { id: "ch-37", title: "First Sino-Japanese War", type: "wikipedia", url: wp("First_Sino-Japanese_War"), theater: "chinese", category: "Sino-Japanese" },
  { id: "ch-38", title: "Nanjing Massacre", type: "wikipedia", url: wp("Nanking_Massacre"), theater: "chinese", category: "Sino-Japanese" },
  { id: "ch-39", title: "Mao Zedong", type: "wikipedia", url: wp("Mao_Zedong"), theater: "chinese", category: "Mao Era" },
  { id: "ch-40", title: "Chiang Kai-shek", type: "wikipedia", url: wp("Chiang_Kai-shek"), theater: "chinese", category: "Civil War" },
  { id: "ch-41", title: "Republic of China (Taiwan)", type: "wikipedia", url: wp("Republic_of_China_(1912%E2%80%931949)"), theater: "chinese", category: "Civil War" },
  { id: "ch-42", title: "Wolf Warrior diplomacy", type: "wikipedia", url: wp("Wolf_Warrior_diplomacy"), theater: "chinese", category: "Modern" },
  { id: "ch-43", title: "The Third Revolution", type: "book", author: "Elizabeth C. Economy", year: "2018", theater: "chinese", category: "Modern" },
  { id: "ch-44", title: "The Pivot", type: "book", author: "Kurt M. Campbell", year: "2016", theater: "chinese", category: "Geopolitics" },
];

export function getSourcesByTheater(theater: "iranian" | "russian" | "chinese") {
  return KNOWLEDGE_SOURCES.filter((s) => s.theater === theater);
}

export function getCategoriesForTheater(theater: "iranian" | "russian" | "chinese"): string[] {
  const cats = new Set(KNOWLEDGE_SOURCES.filter((s) => s.theater === theater).map((s) => s.category));
  return Array.from(cats).sort();
}
