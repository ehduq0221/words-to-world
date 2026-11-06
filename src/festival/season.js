export function festivalSeason(date,schedule){
 const key=`${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`;
 return schedule.seasons.find(season=>key>=season.start&&key<=season.end)||null;
}
