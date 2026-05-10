import type { Meet } from "@/types/domain";

type MeetRegistrationStatus = "registering_now" | "unknown";
type MeetEligibilityStatus = "eligible";
type MeetSourceUrlStatus = "pending_discovery";
type MeetStatusLabel =
  | "canceled"
  | "postponed"
  | "moved"
  | "do_not_enter"
  | "do_not_use";

export type MeetCalendarSeed = Meet & {
  rawDate: string;
  startDate: string;
  endDate: string;
  season: "Outdoor 2026";
  eligibilityStatus: MeetEligibilityStatus;
  sourceUrlStatus: MeetSourceUrlStatus;
  registrationStatus: MeetRegistrationStatus;
  statusLabel?: MeetStatusLabel;
};

type MeetSeedRow = {
  rawDate: string;
  name: string;
  location: string;
  registrationStatus?: Extract<MeetRegistrationStatus, "registering_now">;
};

const SEASON_YEAR = 2026;

const meetSeedRows: MeetSeedRow[] = [
  { rawDate: "12/31", name: "Rangely Meet", location: "Rangely, CO" },
  {
    rawDate: "7/11",
    name: "Broken Track Meet (Do not enter)",
    location: "Greeley, CO",
  },
  { rawDate: "4/2", name: "FFCHS JV #2", location: "Fountain, CO" },
  {
    rawDate: "4/15 - 5/15",
    name: "Frontier Patriot League JV Meet",
    location: "Greeley, CO",
  },
  {
    rawDate: "2/8",
    name: "Hustle Throws Super Sunday Invite",
    location: "Aurora, CO",
  },
  {
    rawDate: "3/5",
    name: "City of Greeley Championships",
    location: "Greeley, CO",
  },
  {
    rawDate: "3/5",
    name: "Ralston Valley Invitational",
    location: "Lakewood, CO",
  },
  { rawDate: "3/5", name: "Regis Groff Relays", location: "Denver, CO" },
  {
    rawDate: "3/5",
    name: "St. Vrain RE-1J District Meet",
    location: "Longmont, CO",
  },
  {
    rawDate: "3/7",
    name: "Aurora City Championships- Canceled",
    location: "Aurora, CO",
  },
  {
    rawDate: "3/7",
    name: "Continental League Early Bird",
    location: "Parker, CO",
  },
  {
    rawDate: "3/7",
    name: "Coyote Invite Canceled",
    location: "Lafayette, CO",
  },
  {
    rawDate: "3/7",
    name: "CSU-Pueblo Early-Bird",
    location: "Pueblo, CO",
  },
  {
    rawDate: "3/7",
    name: "Delta Panther Invitational",
    location: "Delta, CO",
  },
  { rawDate: "3/7", name: "Durango Dust Off", location: "Durango, CO" },
  {
    rawDate: "3/7",
    name: "Early Season City League - cancelled",
    location: "Denver, CO",
  },
  {
    rawDate: "3/7",
    name: "John Martin Early Bird Invite",
    location: "Fort Collins, CO",
  },
  {
    rawDate: "3/7",
    name: "Max Marr Invitational",
    location: "Berthoud, CO",
  },
  {
    rawDate: "3/7",
    name: "Mesa County Invite",
    location: "Grand Junction, CO",
  },
  {
    rawDate: "3/7",
    name: "Palmer Terror Invitational ** POSTPONED**",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "3/7",
    name: "Wolfpack Invite",
    location: "Colorado Springs, CO",
  },
  { rawDate: "3/11", name: "Boulder Quad", location: "Lafayette, CO" },
  { rawDate: "3/11", name: "D60 JV Meet", location: "Pueblo, CO" },
  { rawDate: "3/11", name: "FFCHS JV #1", location: "Fountain, CO" },
  {
    rawDate: "3/11",
    name: "Jeffco Non-Qual #1",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/11",
    name: "NoCo JV Series #1",
    location: "Johnstown, CO",
  },
  {
    rawDate: "3/11",
    name: "RRMR JV Meet",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "3/11",
    name: "Thornton Early Bird",
    location: "Westminster, CO",
  },
  {
    rawDate: "3/12 - 3/21",
    name: "Fightin' Reds Invitational GO TO CALENDAR 3/21",
    location: "Eaton, CO",
  },
  {
    rawDate: "3/12",
    name: "Jeffco Non-Qual #2",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/13",
    name: "Bayfield Invitational #1",
    location: "Bayfield, CO",
  },
  {
    rawDate: "3/13",
    name: "Centennial League Non - Qualifier",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "3/13",
    name: "Rifle High School Invitational",
    location: "Rifle, CO",
  },
  {
    rawDate: "3/14",
    name: "Golden Eagle Invitational",
    location: "Frederick, CO",
  },
  {
    rawDate: "3/14",
    name: "Harrison Panther Invite",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "3/14",
    name: "LPS Spring Break Duals",
    location: "Centennial, CO",
  },
  {
    rawDate: "3/14",
    name: "Murray Kula Invitational",
    location: "Windsor, CO",
  },
  {
    rawDate: "3/14",
    name: "Norsemen Invitational",
    location: "Westminster, CO",
  },
  { rawDate: "3/14", name: "Ridgway Invite", location: "Ridgway, CO" },
  {
    rawDate: "3/14",
    name: "The Banana Belt Classic",
    location: "Pueblo, CO",
  },
  {
    rawDate: "3/14",
    name: "ThunderRidge Invitational",
    location: "Parker, CO",
  },
  {
    rawDate: "3/17",
    name: "City League Relay Meet",
    location: "Denver, CO",
  },
  {
    rawDate: "3/18",
    name: "Coronado Cougars JV Invite",
    location: "Colorado Springs, CO 80904, CO",
  },
  {
    rawDate: "3/18",
    name: "Jeffco Non-Qual #3",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/18",
    name: "Lancer Invite",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "3/18",
    name: "Platte Valley Patriot League JV Meet",
    location: "Kersey, CO",
  },
  {
    rawDate: "3/18",
    name: "PPAC JV Meet #1",
    location: "Monument, CO",
  },
  {
    rawDate: "3/18",
    name: "Rifle JV Invitational",
    location: "Rifle, CO",
  },
  {
    rawDate: "3/19",
    name: "Jeffco Non-Qual #4",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/20",
    name: "Arvada City Championships",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/20",
    name: "Beetdigger Invitational",
    location: "Brush, CO",
  },
  {
    rawDate: "3/20 - 3/21",
    name: "Texas Distance Festival",
    location: "Southlake, TX",
  },
  {
    rawDate: "3/20",
    name: "The Showdown at Rocky Mountain Arsenal",
    location: "Commerce City, CO",
  },
  {
    rawDate: "3/21",
    name: "Broomfield Shootout",
    location: "Broomfield, CO",
  },
  {
    rawDate: "3/21",
    name: "Fightin' Reds Invitational",
    location: "Eaton, CO",
  },
  {
    rawDate: "3/21",
    name: "Ivory Moore \"We Are Columbine\" Invite",
    location: "Lakewood, CO",
  },
  {
    rawDate: "3/21",
    name: "Larry Pickering Centennial Inv.",
    location: "Pueblo, CO",
  },
  {
    rawDate: "3/21",
    name: "North Fork Invitational",
    location: "Hotchkiss, CO",
  },
  {
    rawDate: "3/21",
    name: "Runners Roost Invite",
    location: "Fort Collins, CO",
  },
  { rawDate: "3/23", name: "Yuma Early Qualifier", location: "Yuma, CO" },
  { rawDate: "3/24", name: "DPS JV Meet #2", location: "Denver, CO" },
  {
    rawDate: "3/24",
    name: "Indiana v. Greater Latrobe HS",
    location: "Indiana, PA",
  },
  {
    rawDate: "3/24",
    name: "Lyons Unlimited *CANCELED",
    location: "Lyons, CO",
  },
  {
    rawDate: "3/24",
    name: "Palisade JV Invitational",
    location: "Grand Junction, CO",
  },
  {
    rawDate: "3/25",
    name: "Continental League JV Non Qual #1",
    location: "Parker, CO",
  },
  {
    rawDate: "3/25",
    name: "NoCo JV Series #2",
    location: "Berthoud, CO",
  },
  {
    rawDate: "3/25",
    name: "PSD JV Invite #1",
    location: "Fort Collins, CO",
  },
  {
    rawDate: "3/25",
    name: "University Patriot League JV Meet",
    location: "Greeley, CO",
  },
  {
    rawDate: "3/26 - 3/28",
    name: "Morehouse relays",
    location: "Atlanta, GA",
  },
  {
    rawDate: "3/26",
    name: "Denver South Ravens Invitational",
    location: "Denver, CO",
  },
  { rawDate: "3/26", name: "Durango Weekday", location: "Las Vegas, NV" },
  {
    rawDate: "3/27 - 3/28",
    name: "FSU Relays (High Schools)",
    location: "Tallahassee, FL",
  },
  {
    rawDate: "3/27",
    name: "KC Logan R2J Invitational",
    location: "Berthoud, CO",
  },
  {
    rawDate: "3/27 - 3/28",
    name: "NIKE Rocket City Showcase",
    location: "Huntsville, AL",
  },
  {
    rawDate: "3/27",
    name: "On Ye Bruins Relays",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "3/27",
    name: "Roosevelt Power Meet Invitational",
    location: "Johnstown, CO",
  },
  {
    rawDate: "3/27",
    name: "Wayne Thomas Memorial Invitational",
    location: "Mosca, CO",
  },
  {
    rawDate: "3/28",
    name: "Chaparral Invitational",
    location: "Parker, CO",
  },
  {
    rawDate: "3/28",
    name: "Blue & Gold Invitational",
    location: "Greeley, CO",
  },
  {
    rawDate: "3/28",
    name: "Cedaredge Invitational",
    location: "Cedaredge, CO",
  },
  {
    rawDate: "3/28",
    name: "Grandview Invite",
    location: "Greenwood Village, CO",
  },
  { rawDate: "3/28", name: "Kiowa Klassic", location: "Limon, CO" },
  { rawDate: "3/28", name: "Lamar Invite", location: "Lamar, CO" },
  {
    rawDate: "3/28",
    name: "Mickey Dunn Invitational",
    location: "Grand Junction, CO",
  },
  { rawDate: "3/28", name: "Niwot Invitational", location: "Niwot, CO" },
  {
    rawDate: "3/28",
    name: "Pine River Invitational",
    location: "Bayfield, CO",
  },
  {
    rawDate: "3/28",
    name: "University Bulldog Invitational",
    location: "Greeley, CO",
  },
  {
    rawDate: "3/30",
    name: "Santa Fe League Meet",
    location: "Rocky Ford, CO",
  },
  {
    rawDate: "3/31",
    name: "Greeley County Early Season Meet",
    location: "Tribune, KS",
  },
  {
    rawDate: "3/31",
    name: "NoCo - Roosevelt Qualifier (Postponed)",
    location: "Johnstown, CO",
  },
  {
    rawDate: "3/31",
    name: "NoCo - Roosevelt Qualifier - CANCELLED",
    location: "Johnstown, CO",
  },
  {
    rawDate: "4/1",
    name: "Continental League JV #2",
    location: "Parker, CO",
  },
  {
    rawDate: "4/1",
    name: "Eaton Patriot League JV Meet",
    location: "Eaton, CO",
  },
  { rawDate: "4/1", name: "FFCHS JV #2", location: "Fountain, CO" },
  {
    rawDate: "4/1",
    name: "Jaguar Non-Qual #1",
    location: "Broomfield, CO",
  },
  {
    rawDate: "4/1",
    name: "NoCo JV Meet #3",
    location: "Frederick, CO",
  },
  {
    rawDate: "4/1",
    name: "Pirate JV Invite",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/1",
    name: "PSD JV Invite #2",
    location: "Fort Collins, CO",
  },
  {
    rawDate: "4/1",
    name: "RML April Fool's JV",
    location: "Boulder, CO",
  },
  {
    rawDate: "4/2",
    name: "Del Norte vs Mt Carmel",
    location: "San Diego, CA",
  },
  { rawDate: "4/2", name: "Durango Weekday", location: "Las Vegas, NV" },
  {
    rawDate: "4/2",
    name: "Eaton Throwers Showcase",
    location: "Eaton, OH",
  },
  {
    rawDate: "4/2 - 4/3",
    name: "High Desert Dental Maverick Invite",
    location: "Grand Junction , CO",
  },
  {
    rawDate: "4/2",
    name: "PPAC League Championship",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/2",
    name: "Valor Invitational",
    location: "Highlands Ranch, CO",
  },
  { rawDate: "4/3", name: "B-Town Bash", location: "Broomfield, CO" },
  {
    rawDate: "4/3",
    name: "City of Littleton Championships",
    location: "Littleton, CO",
  },
  {
    rawDate: "4/3",
    name: "D'Evelyn Jack & Jill Relays",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/3",
    name: "John Tate Steel City Fast Track Invitational",
    location: "Pueblo, CO",
  },
  {
    rawDate: "4/3 - 4/6",
    name: "Silver Knight Invitational - CANCELED",
    location: "Severance, CO",
  },
  {
    rawDate: "4/4",
    name: "**Cancelled** Birds of Prey Invitational",
    location: "Longmont, CO",
  },
  {
    rawDate: "4/4",
    name: "Warren Mitchell Invitational",
    location: "Limon, CO",
  },
  {
    rawDate: "4/4",
    name: "Abel Velasquez Invitational",
    location: "Ignacio, CO",
  },
  {
    rawDate: "4/4",
    name: "Altitude Invite",
    location: "Fort Collins, CO",
  },
  {
    rawDate: "4/4",
    name: "David S. D'Evelyn Invitational",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/4",
    name: "Eagle Valley Invitational",
    location: "Gypsum, CO",
  },
  {
    rawDate: "4/4",
    name: "Five Star JV Jamboree",
    location: "Thornton, CO",
  },
  {
    rawDate: "4/4",
    name: "Fountain-Fort Carson Invitational",
    location: "Fountain, CO",
  },
  {
    rawDate: "4/4",
    name: "Frank Woodburn Invitational",
    location: "Grand Junction, CO",
  },
  {
    rawDate: "4/4",
    name: "Hinkley Thunder Throwdown",
    location: "Aurora, CO",
  },
  {
    rawDate: "4/4",
    name: "Legend Titan Track Clash",
    location: "Parker, CO",
  },
  {
    rawDate: "4/4",
    name: "Salida Invitational Track Meet",
    location: "Salida, CO",
  },
  { rawDate: "4/4", name: "Wiggins Invitational", location: "Wiggins, CO" },
  {
    rawDate: "4/6",
    name: "Yuma Bill Kalb Invitational",
    location: "Yuma, CO",
  },
  { rawDate: "4/6", name: "Delta JV Invitational", location: "Delta, CO" },
  { rawDate: "4/7", name: "Englewood Open #1", location: "Englewood, CO" },
  {
    rawDate: "4/7",
    name: "Jeffco Freshman Dennis Shepherd Invite",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/7",
    name: "Metropolitan League Relays",
    location: "Broomfield, CO",
  },
  { rawDate: "4/7", name: "NoCo JV Meet #4", location: "Loveland, CO" },
  { rawDate: "4/8", name: "FFCHS JV #3", location: "Fountain, CO" },
  {
    rawDate: "4/8",
    name: "Greeley West Freshman/Sophomore Championships",
    location: "Greeley, CO",
  },
  {
    rawDate: "4/8",
    name: "Highland Patriot League JV Meet",
    location: "Ault, CO",
  },
  {
    rawDate: "4/8 - 4/9",
    name: "Mines Midweek Meet",
    location: "Golden, CO",
  },
  {
    rawDate: "4/8",
    name: "MR Pre-Prom Invite",
    location: "Westminster, CO",
  },
  { rawDate: "4/8", name: "NoCo JV Meet #4", location: "Loveland, CO" },
  {
    rawDate: "4/8",
    name: "Ponderosa Frosh/Soph Invitational",
    location: "Parker, CO",
  },
  {
    rawDate: "4/8",
    name: "PPAC JV Meet #2",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/8",
    name: "Randy Yaussi PSD Meet",
    location: "Fort Collins, CO",
  },
  { rawDate: "4/9", name: "Dick Evans Invitational", location: "Wray, CO" },
  {
    rawDate: "4/9",
    name: "Don Osse Lakewood Tiger Invitational",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/9",
    name: "Titan Invite",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/10",
    name: "Arcadia Invitational",
    location: "Arcadia, CA",
  },
  {
    rawDate: "4/10",
    name: "Bob Archibeque Invitational",
    location: "Cortez, CO",
  },
  {
    rawDate: "4/10 - 4/11",
    name: "Demon Invitational",
    location: "Glenwood Springs, CO",
  },
  {
    rawDate: "4/10",
    name: "Greeley County HS Invitational",
    location: "Tribune, KS",
  },
  {
    rawDate: "4/10",
    name: "Grizzly Invitational",
    location: "Greeley, CO",
  },
  {
    rawDate: "4/10",
    name: "Phil Wertman Invitational",
    location: "Grand Junction, CO",
  },
  {
    rawDate: "4/10",
    name: "Ray Headley Invitational",
    location: "Swink, CO",
  },
  {
    rawDate: "4/10 - 4/11",
    name: "The Pomona Invitational",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/10",
    name: "Thomas Jefferson Twilight",
    location: "Denver, CO",
  },
  {
    rawDate: "4/11",
    name: "Mullen Invitiational",
    location: "Denver, CO",
  },
  {
    rawDate: "4/11",
    name: "Boulder County Track Championships",
    location: "Broomfield, CO",
  },
  {
    rawDate: "4/11",
    name: "Del Norte Tiger Invitational",
    location: "Del Norte, CO",
  },
  {
    rawDate: "4/11",
    name: "Lions Classic Invitational",
    location: "Littleton, CO",
  },
  {
    rawDate: "4/11",
    name: "Petrelli and Hunt Invitational",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/11",
    name: "Terry Amundson Invitational",
    location: "Byers, CO",
  },
  {
    rawDate: "4/11",
    name: "Thunder-Storm Invitational",
    location: "Pueblo, CO",
  },
  {
    rawDate: "4/11",
    name: "Valley Viking Valhalla Classic/Unified Track Meet",
    location: "Gilcrest, CO",
  },
  {
    rawDate: "4/13",
    name: "Centennial League Non - Qualifier",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "4/13",
    name: "Continental League JV #3",
    location: "Parker, CO",
  },
  {
    rawDate: "4/14",
    name: "Battle Mountain Husky Invitational",
    location: "Edwards, CO",
  },
  { rawDate: "4/14", name: "DPS JV Meet #4", location: "Denver, CO" },
  { rawDate: "4/14", name: "Merino Invitational", location: "Merino, CO" },
  {
    rawDate: "4/15",
    name: "Strasburg Dave Spiller Invitational",
    location: "Strasburg, CO",
  },
  {
    rawDate: "4/15",
    name: "4A Jeffco League Relays Qualifier",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/15",
    name: "Continental League JV#3",
    location: "Parker, CO",
  },
  {
    rawDate: "4/15",
    name: "Coronado Cougars JV Invite",
    location: "Colorado Springs, CO 80904, CO",
  },
  { rawDate: "4/15", name: "Durango Weekday", location: "Las Vegas, NV" },
  { rawDate: "4/15", name: "Fairview JV Invite", location: "Boulder, CO" },
  {
    rawDate: "4/15",
    name: "Frontier Patriot League JV Meet",
    location: "Greeley, CO",
  },
  {
    rawDate: "4/15",
    name: "NoCo JV Series #5",
    location: "Greeley, CO",
  },
  {
    rawDate: "4/15",
    name: "PSD JV Invite #3",
    location: "Fort Collins, CO",
  },
  {
    rawDate: "4/16",
    name: "5A Jeffco League Relays Qualifier",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/16",
    name: "Centaurus Twilight (Now on 4/16)",
    location: "Lafayette, CO",
  },
  {
    rawDate: "4/16",
    name: "Mines Midweek Meet",
    location: "Golden, CO",
  },
  {
    rawDate: "4/16",
    name: "MV Unified Heart and Soul Invite",
    location: "Loveland, CO",
  },
  {
    rawDate: "4/16",
    name: "Tiger-Boom (Lamar/LJ only- JV)",
    location: "La Junta, CO",
  },
  {
    rawDate: "4/16",
    name: "Western Slope RMAC Last Chance",
    location: "Gunnison, CO",
  },
  {
    rawDate: "4/17",
    name: "Center JV (freshman/sophomore)",
    location: "Center, CO",
  },
  {
    rawDate: "4/17",
    name: "Coal Ridge Invitational",
    location: "New Castle, CO",
  },
  {
    rawDate: "4/17",
    name: "La Junta Tiger Relays",
    location: "La Junta, CO",
  },
  {
    rawDate: "4/17 - 4/18",
    name: "Mines Pre-Conference",
    location: "Golden, CO",
  },
  {
    rawDate: "4/17 - 4/18",
    name: "RunningLane Kansas City Relays",
    location: "Blue Springs, MO",
  },
  {
    rawDate: "4/17 - 4/18",
    name: "Volunteer Track Classic",
    location: "Knoxville, TN",
  },
  {
    rawDate: "4/18",
    name: "*** CANCELLED *** Fort Morgan Invitational",
    location: "Fort Morgan, CO",
  },
  { rawDate: "4/18", name: "Bronco Stampede", location: "Kersey, CO" },
  {
    rawDate: "4/18",
    name: "Cherry Creek Invitational",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "4/18",
    name: "Dakota Ridge Invitational",
    location: "Lakewood, CO",
  },
  { rawDate: "4/18", name: "Husky Invitational", location: "Florence, CO" },
  {
    rawDate: "4/18",
    name: "Mustang Invitational *CANCELLED*",
    location: "Westminster, CO",
  },
  {
    rawDate: "4/18",
    name: "Northfield Nighthawk Invite",
    location: "Denver, CO",
  },
  {
    rawDate: "4/18",
    name: "Randall Hess Roughrider Invitational",
    location: "Johnstown, CO",
  },
  {
    rawDate: "4/18",
    name: "Rangely Panther Invitational",
    location: "Rangely, CO",
  },
  {
    rawDate: "4/18",
    name: "Ron Keller Invitational",
    location: "Durango, CO",
  },
  {
    rawDate: "4/18",
    name: "Tiger Invitational",
    location: "Cheyenne Wells, CO",
  },
  {
    rawDate: "4/20",
    name: "Colorado Springs All City Meet",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/20",
    name: "Huskie Twilight (meet moved to 4/20)",
    location: "Parker, CO",
  },
  { rawDate: "4/20", name: "HWAY Invitational", location: "Akron, CO" },
  {
    rawDate: "4/20",
    name: "NoCo JV Meet #6",
    location: "Thornton , CO",
  },
  { rawDate: "4/21", name: "Englewood Open #2", location: "Englewood, CO" },
  {
    rawDate: "4/21",
    name: "Montrose JV Invitational",
    location: "Montrose, CO",
  },
  {
    rawDate: "4/21",
    name: "St. John High School Freshman-Sophomore Track Meet",
    location: "Saint John, KS",
  },
  {
    rawDate: "4/22",
    name: "4A Jeffco JV Championships",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/22",
    name: "Adams 12 Five Star Championships",
    location: "Westminster, CO",
  },
  {
    rawDate: "4/22",
    name: "Colorado Springs Christian School Invitational",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/22",
    name: "Continental League Frosh/Soph Championships",
    location: "Parker, CO",
  },
  {
    rawDate: "4/22",
    name: "DO NOT USE Championship",
    location: "Westminster, CO",
  },
  {
    rawDate: "4/22",
    name: "DPS - City League JV Championships",
    location: "Aurora, CO",
  },
  {
    rawDate: "4/22",
    name: "Greeley Twilight Invitational",
    location: "Greeley, CO",
  },
  {
    rawDate: "4/22",
    name: "JV Championships @ Longmont HS",
    location: "Longmont, CO",
  },
  {
    rawDate: "4/22",
    name: "NoCo Berthoud Qualifier MOVED TO 4/21!",
    location: "Berthoud, CO",
  },
  {
    rawDate: "4/22",
    name: "The Ridge Ridge Mountain Ridge Classical JV Championship",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/22",
    name: "Valley Patriot League JV Meet",
    location: "Gilcrest, CO",
  },
  {
    rawDate: "4/23",
    name: "SCL Pueblo City/County Championships",
    location: "Pueblo, CO",
  },
  {
    rawDate: "4/23",
    name: "5A Jeffco JV Championships",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/23",
    name: "Northern League JV Championship",
    location: "Windsor, CO",
  },
  {
    rawDate: "4/23",
    name: "Olathe Invitational",
    location: "Olathe, CO",
  },
  {
    rawDate: "4/23",
    name: "Stutler Twilight",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "4/23 - 4/25",
    name: "The 130th Penn Relays celebrating with America250",
    location: "Philadelphia, PA",
  },
  {
    rawDate: "4/24 - 4/25",
    name: "Liberty Bell Invitational",
    location: "Littleton, CO",
  },
  {
    rawDate: "4/24",
    name: "Clint Wells Invitational",
    location: "Craig, CO",
  },
  { rawDate: "4/24", name: "Haxtun Relays", location: "Holyoke, CO" },
  { rawDate: "4/24", name: "Haxtun Relays!", location: "Holyoke, CO" },
  {
    rawDate: "4/24",
    name: "High Altitude Challenge/ IML Conference",
    location: "Alamosa, CO",
  },
  {
    rawDate: "4/24",
    name: "Keith Blide Invitational Track Meet",
    location: "Saint John, KS",
  },
  {
    rawDate: "4/24",
    name: "Longmont Invitational",
    location: "Longmont, CO",
  },
  {
    rawDate: "4/24 - 4/26",
    name: "RMAC Outdoor Championships",
    location: "Pueblo, CO",
  },
  {
    rawDate: "4/24",
    name: "Rye Thunderbolt Invitational",
    location: "Rye, CO",
  },
  {
    rawDate: "4/25",
    name: "***Cancelled***Hayden Valley Track Meet",
    location: "Hayden, CO",
  },
  {
    rawDate: "4/25",
    name: "Cougar Classic Invitational *Cancelled due to lack of officials",
    location: "Colorado Springs, CO",
  },
  { rawDate: "4/25", name: "Cowboy Invitational", location: "Denver, CO" },
  {
    rawDate: "4/25",
    name: "District 2 Invitational",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/25",
    name: "Lobo Phantom Last Chance - Senior Night (HS/JH)",
    location: ", AZ",
  },
  {
    rawDate: "4/25",
    name: "Mancos Bluejays Invitational",
    location: "Mancos, CO",
  },
  {
    rawDate: "4/25",
    name: "Ram Charger Invitational",
    location: "Lakewood, CO",
  },
  { rawDate: "4/25", name: "Tom Meyer Invite", location: "Akron, CO" },
  {
    rawDate: "4/25",
    name: "Tri-Peaks League Meet",
    location: "Florence, CO",
  },
  {
    rawDate: "4/25",
    name: "Tri-Peaks League Meet",
    location: "Florence, CO",
  },
  {
    rawDate: "4/25",
    name: "Weld County Championships",
    location: "Johnstown, CO",
  },
  {
    rawDate: "4/26",
    name: "Hustle Hammer Throw Showcase",
    location: "Strasburg, CO",
  },
  {
    rawDate: "4/27",
    name: "Continental League JV Championships",
    location: "Parker, CO",
  },
  {
    rawDate: "4/27",
    name: "Western Slope JV Championships & Varsity Relays",
    location: "Grand Junction, CO",
  },
  {
    rawDate: "4/28",
    name: "Frontier League Championships",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/28",
    name: "Highland Twilight Invitational",
    location: "Ault, CO",
  },
  {
    rawDate: "4/28",
    name: "San Juan Basin League Meet",
    location: "Mancos, CO",
  },
  {
    rawDate: "4/29",
    name: "**Canceled** Pirate Field Invitational",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/29",
    name: "Centennial League 9/10 Championships",
    location: "Aurora, CO",
  },
  {
    rawDate: "4/29 - 5/2",
    name: "Jeffco 4A/5A League Championships",
    location: "Lakewood, CO",
  },
  {
    rawDate: "4/29",
    name: "Lancer JV Meet",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "4/29 - 5/1",
    name: "Longs Peak/Northern League Championships",
    location: "Johnstown, CO",
  },
  {
    rawDate: "4/29",
    name: "Rocky Mountain League Championships",
    location: "Boulder, CO",
  },
  {
    rawDate: "4/29",
    name: "Sedgwick County Cougar Classic",
    location: "Julesburg, CO",
  },
  {
    rawDate: "4/30 - 5/1",
    name: "3A/4A WSL",
    location: "New Castle, CO",
  },
  {
    rawDate: "4/30",
    name: "Colorado League Championship",
    location: "Thornton, CO",
  },
  {
    rawDate: "4/30 - 5/1",
    name: "Continental League Championship",
    location: "Parker, CO",
  },
  {
    rawDate: "4/30",
    name: "Shawnee Mission West JV",
    location: "Overland Park, KS",
  },
  {
    rawDate: "5/1 - 5/2",
    name: "1A/2A WSL",
    location: "New Castle, CO",
  },
  {
    rawDate: "5/1",
    name: "Burlington Invitational Track Meet",
    location: "Burlington, CO",
  },
  {
    rawDate: "5/1",
    name: "Canon City Blossom Invitational",
    location: "Canon City, CO",
  },
  {
    rawDate: "5/1",
    name: "De Soto Invitational",
    location: "DeSoto, KS",
  },
  {
    rawDate: "5/1 - 5/2",
    name: "DPS - City League Meet",
    location: "Denver, CO",
  },
  {
    rawDate: "5/1",
    name: "HS LPAA LEAGUE MEET",
    location: "Wray, CO",
  },
  {
    rawDate: "5/1 - 5/2",
    name: "Patriot League Meet",
    location: "Greeley, CO",
  },
  {
    rawDate: "5/1 - 5/2",
    name: "SWL Championships",
    location: "Grand Junction, CO",
  },
  { rawDate: "5/1", name: "The Pueblo Twilight", location: "Pueblo, CO" },
  {
    rawDate: "5/2",
    name: "Queen Harrison Track Classic Invitational",
    location: "Henrico, VA",
  },
  {
    rawDate: "5/2",
    name: "Black Forest League Meet",
    location: "Elbert, CO",
  },
  {
    rawDate: "5/2",
    name: "Buff Blazer Invitational",
    location: "Greenwood Village, CO",
  },
  {
    rawDate: "5/2",
    name: "Continental League Championship",
    location: "Parker, CO",
  },
  {
    rawDate: "5/2",
    name: "Doherty Spartan Invitational",
    location: "Colorado Springs, CO",
  },
  {
    rawDate: "5/2",
    name: "Lamar Middle School Invitational",
    location: "Lamar, CO",
  },
  {
    rawDate: "5/2",
    name: "Metro League Championship",
    location: "Westminster, CO",
  },
  {
    rawDate: "5/2",
    name: "Metropolitan League Championships",
    location: "Westminster, CO",
  },
  {
    rawDate: "5/2",
    name: "Rumble on the Divide",
    location: "Elizabeth, CO",
  },
  {
    rawDate: "5/2",
    name: "Southern Peaks League Meet",
    location: "Del Norte, CO",
  },
  {
    rawDate: "5/2",
    name: "Terry Alley Invitational",
    location: "Pagosa Springs, CO",
  },
  {
    rawDate: "5/2",
    name: "Three League Meet: Granite Peaks, Foothills, Mile High",
    location: "Longmont, CO",
  },
  {
    rawDate: "5/4",
    name: "Cardinal Invitational",
    location: "McClave, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/4",
    name: "Cinco de Mayo Invitational",
    location: "Walsenburg, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/4",
    name: "Holyoke Dragon Invitational/Vann Manly Memorial",
    location: "Holyoke, CO",
  },
  {
    rawDate: "5/4",
    name: "LP JV Championship",
    location: "Monument, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/5",
    name: "Spartan Last Chance Qualifier * CANCELLED!",
    location: "Berthoud, CO",
  },
  {
    rawDate: "5/5",
    name: "Triple D Invitational",
    location: "Center, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/6",
    name: "NCL/YWKC League Meet",
    location: "New Raymer, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/6",
    name: "Wild West Twilight Last Chance",
    location: "Grand Junction, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/7 - 5/9",
    name: "Centennial League Championships",
    location: "Littleton, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/7 - 5/9",
    name: "Centennial League Championships",
    location: "Littleton, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/7",
    name: "Delta Twilight",
    location: "Delta, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/7",
    name: "East Angels Fulton Memorial Invitational",
    location: "Denver, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8",
    name: "Monte Vista Last Chance Invitational",
    location: "Monte Vista, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8",
    name: "Friday Night Lights",
    location: "Pueblo West, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8",
    name: "HOKA St. Vrain Invitational",
    location: "Longmont, CO",
  },
  {
    rawDate: "5/8",
    name: "Joe Shields Invitational",
    location: "Kremmling, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8",
    name: "Low Elevation Last Chance",
    location: "Lamar, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8",
    name: "Union Pacific League Meet",
    location: "Limon, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/8 - 5/9",
    name: "Windjammer Track Classic",
    location: "Englewood, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/9",
    name: "Cardinal Invitational",
    location: "Parachute, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/9",
    name: "Maxine Ehrmann Thornton Invite",
    location: "Westminster, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/9",
    name: "Montrose Invitational",
    location: "Montrose, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/9",
    name: "Teddy's Last Chance Qualifier",
    location: "Johnstown, CO",
  },
  {
    rawDate: "5/9",
    name: "Trojan Horse Invitational (Sneak into the State Meet)",
    location: "Fountain, CO",
    registrationStatus: "registering_now",
  },
  {
    rawDate: "5/14 - 5/16",
    name: "Colorado State Championships",
    location: "Lakewood, CO",
    registrationStatus: "registering_now",
  },
];

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function dateToIso(monthDay: string): string {
  const [month, day] = monthDay.split("/").map(Number);

  return `${SEASON_YEAR}-${padDatePart(month)}-${padDatePart(day)}`;
}

function parseDateRange(rawDate: string): { startDate: string; endDate: string } {
  const [start, end = start] = rawDate.split(/\s+-\s+/);

  return {
    startDate: dateToIso(start),
    endDate: dateToIso(end),
  };
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getStatusLabel(name: string): MeetStatusLabel | undefined {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("do not enter")) {
    return "do_not_enter";
  }

  if (normalizedName.includes("do not use")) {
    return "do_not_use";
  }

  if (normalizedName.includes("cancel")) {
    return "canceled";
  }

  if (normalizedName.includes("postponed")) {
    return "postponed";
  }

  if (normalizedName.includes("moved")) {
    return "moved";
  }

  return undefined;
}

function formatStatusLabel(statusLabel: MeetStatusLabel): string {
  return statusLabel.replaceAll("_", " ");
}

function getNotes(
  row: MeetSeedRow,
  statusLabel: MeetStatusLabel | undefined,
): string | undefined {
  const notes: string[] = [];

  if (statusLabel) {
    notes.push(
      `Calendar row status: ${formatStatusLabel(statusLabel)}. Kept eligible for discovery per user instruction.`,
    );
  }

  if (row.registrationStatus === "registering_now") {
    notes.push("Calendar row was marked Registering Now.");
  }

  return notes.length ? notes.join(" ") : undefined;
}

function buildMeet(row: MeetSeedRow, index: number): MeetCalendarSeed {
  const { startDate, endDate } = parseDateRange(row.rawDate);
  const statusLabel = getStatusLabel(row.name);
  const sequence = (index + 1).toString().padStart(3, "0");

  return {
    id: `meet-2026-${sequence}-${toSlug(row.rawDate)}-${toSlug(row.name)}`,
    name: row.name,
    rawDate: row.rawDate,
    date: endDate,
    startDate,
    endDate,
    location: row.location,
    season: "Outdoor 2026",
    eligibilityStatus: "eligible",
    sourceUrlStatus: "pending_discovery",
    registrationStatus: row.registrationStatus ?? "unknown",
    statusLabel,
    discoveredSourceUrls: [],
    secondaryResultsUrls: [],
    discoveryStatus: "not_started",
    notes: getNotes(row, statusLabel),
  };
}

export const meets: MeetCalendarSeed[] = meetSeedRows.map(buildMeet);
