// src/lib/regionUtils.js
import { supabase } from './supabase';

export async function detectRegion(county, zip) {
  if (!county) return null;

  if (county === 'Los Angeles') {
    if (!zip || zip.length < 5) return null;

    const { data: zipRow, error: zipErr } = await supabase
      .from('ca_la_region15_zips')
      .select('zip_code')
      .eq('zip_code', zip.trim())
      .maybeSingle();

    console.log('LA zip lookup:', { zipRow, zipErr });

    const regionNumber = zipRow ? 15 : 16;

    const { data: region, error: regionErr } = await supabase
      .from('ca_regions')
      .select('id, region_number, region_name')
      .eq('region_number', regionNumber)
      .maybeSingle();

    console.log('LA region lookup:', { region, regionErr });
    return region || null;
  }

  const { data: countyRow, error: countyErr } = await supabase
    .from('ca_counties')
    .select('region_number')
    .eq('county_name', county)
    .maybeSingle();

  console.log('County lookup:', { county, countyRow, countyErr });

  if (!countyRow?.region_number) return null;

  const { data: region, error: regionErr } = await supabase
    .from('ca_regions')
    .select('id, region_number, region_name')
    .eq('region_number', countyRow.region_number)
    .maybeSingle();

  console.log('Region lookup:', { region, regionErr });
  return region || null;
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
