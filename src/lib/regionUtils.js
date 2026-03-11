// src/lib/regionUtils.js
import { supabase } from './supabase';

export async function detectRegion(county, zip) {
  if (!county) return null;

  if (county === 'Los Angeles') {
    if (zip && zip.length === 5) {
      const { data: zipRow } = await supabase
        .from('region15_zips')
        .select('zip_code')
        .eq('zip_code', zip.trim())
        .maybeSingle();

      const regionNumber = zipRow ? 15 : 16;

      const { data: region } = await supabase
        .from('regions')
        .select('id, region_number, region_name')
        .eq('region_number', regionNumber)
        .maybeSingle();

      return region || null;
    }
    return null;
  }

  const { data: countyRow } = await supabase
    .from('counties')
    .select('region_id, regions(id, region_number, region_name)')
    .eq('county_name', county)
    .maybeSingle();

  return countyRow?.regions || null;
}

export const CA_COUNTIES = [
  'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa',
  'Contra Costa', 'Del Norte', 'El Dorado', 'Fresno', 'Glenn', 'Humboldt',
  'Imperial', 'Inyo', 'Kern', 'Kings', 'Lake', 'Lassen', 'Los Angeles',
  'Madera', 'Marin', 'Mariposa', 'Mendocino', 'Merced', 'Modoc', 'Mono',
  'Monterey', 'Napa', 'Nevada', 'Orange', 'Placer', 'Plumas', 'Riverside',
  'Sacramento', 'San Benito', 'San Bernardino', 'San Diego', 'San Francisco',
  'San Joaquin', 'San Luis Obispo', 'San Mateo', 'Santa Barbara',
  'Santa Clara', 'Santa Cruz', 'Shasta', 'Sierra', 'Siskiyou', 'Solano',
  'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity', 'Tulare',
  'Tuolumne', 'Ventura', 'Yolo', 'Yuba',
];
