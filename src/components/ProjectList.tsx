import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Filter, Search, Droplets, Mountain, Trees, Leaf } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { ProjectDetail, SketchProject, NaturePotential } from '@/lib/types';
import { loadProjectGeometries } from '@/lib/data';
import { getPhaseConfig } from '@/lib/phase-config';
import { ProjectMiniMap } from './ProjectMiniMap';
import { ProjectMapOverlay } from './ProjectMapOverlay';
import type { ProjectMapInfo } from './ProjectMapOverlay';

type Tab = 'projects' | 'sketches' | 'nature';
type PhaseFilter = 'all' | 'established' | 'approved' | 'preliminary';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

interface ProjectListProps {
  projectDetails: ProjectDetail[];
  sketchProjects: SketchProject[];
  naturePotentials: NaturePotential[];
  activePillar: string;
}

export function ProjectList({ projectDetails, sketchProjects, naturePotentials, activePillar }: ProjectListProps) {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [geometries, setGeometries] = useState<Record<string, [number, number][]> | null>(null);
  const geoLoadedRef = useRef(false);
  const [overlayData, setOverlayData] = useState<{ coordinates: [number, number][]; info: ProjectMapInfo } | null>(null);

  const openMapOverlay = useCallback((coords: [number, number][], info: ProjectMapInfo) => {
    setOverlayData({ coordinates: coords, info });
  }, []);

  // Lazy-load geometries on first expand
  useEffect(() => {
    if (expandedId && !geoLoadedRef.current) {
      geoLoadedRef.current = true;
      loadProjectGeometries().then(setGeometries);
    }
  }, [expandedId]);

  const totalItems = projectDetails.length + sketchProjects.length + naturePotentials.length;
  if (totalItems === 0) return null;

  const tabs: { id: Tab; label: string; count: number; show: boolean }[] = [
    { id: 'projects', label: 'Projekter', count: projectDetails.length, show: projectDetails.length > 0 },
    { id: 'sketches', label: 'Skitser', count: sketchProjects.length, show: sketchProjects.length > 0 },
    { id: 'nature', label: 'Naturpotentialer', count: naturePotentials.length, show: activePillar === 'nature' && naturePotentials.length > 0 },
  ];

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projektdetaljer</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {tabs.filter(t => t.show).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label} <span className="opacity-60">({formatDanishNumber(tab.count)})</span>
          </button>
        ))}
      </div>

      {/* Search & filter bar (projects and sketches tabs) */}
      {(activeTab === 'projects' && projectDetails.length > 5) || (activeTab === 'sketches' && sketchProjects.length > 5) ? (
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'sketches' ? 'Søg i skitser...' : 'Søg i projekter...'}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          {activeTab === 'projects' && (
            <select
              value={phaseFilter}
              onChange={e => setPhaseFilter(e.target.value as PhaseFilter)}
              className="px-2 py-1.5 text-[11px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">Alle faser</option>
              <option value="established">Anlagt</option>
              <option value="approved">Godkendt</option>
              <option value="preliminary">Forundersøgelse</option>
            </select>
          )}
        </div>
      ) : null}

      {/* Tab content */}
      {activeTab === 'projects' && (
        <ProjectsTab
          projects={projectDetails}
          phaseFilter={phaseFilter}
          searchQuery={searchQuery}
          expandedId={expandedId}
          onToggle={id => setExpandedId(expandedId === id ? null : id)}
          geometries={geometries}
          onOpenMap={openMapOverlay}
        />
      )}
      {activeTab === 'sketches' && (
        <SketchesTab
          sketches={sketchProjects}
          expandedId={expandedId}
          onToggle={id => setExpandedId(expandedId === id ? null : id)}
          geometries={geometries}
          searchQuery={searchQuery}
          onOpenMap={openMapOverlay}
        />
      )}
      {activeTab === 'nature' && (
        <NaturePotentialsTab
          potentials={naturePotentials}
          expandedId={expandedId}
          onToggle={id => setExpandedId(expandedId === id ? null : id)}
        />
      )}

      {/* Full-screen map overlay */}
      {overlayData && (
        <ProjectMapOverlay
          coordinates={overlayData.coordinates}
          info={overlayData.info}
          onClose={() => setOverlayData(null)}
        />
      )}
    </div>
  );
}

function ProjectsTab({
  projects, phaseFilter, searchQuery, expandedId, onToggle, geometries, onOpenMap
}: {
  projects: ProjectDetail[];
  phaseFilter: PhaseFilter;
  searchQuery: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  geometries: Record<string, [number, number][]> | null;
  onOpenMap: (coords: [number, number][], info: ProjectMapInfo) => void;
}) {
  const filtered = useMemo(() => {
    let list = projects;
    if (phaseFilter !== 'all') {
      list = list.filter(p => p.phase === phaseFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.measureName.toLowerCase().includes(q) ||
        p.schemeName.toLowerCase().includes(q)
      );
    }
    // Sort: established first, then approved, then preliminary; within each: by nitrogen desc
    const order = { established: 0, approved: 1, preliminary: 2 };
    return [...list].sort((a, b) => {
      const phaseD = (order[a.phase] ?? 3) - (order[b.phase] ?? 3);
      if (phaseD !== 0) return phaseD;
      return b.nitrogenT - a.nitrogenT;
    });
  }, [projects, phaseFilter, searchQuery]);

  if (filtered.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-3 text-center">
        Ingen projekter matcher{phaseFilter !== 'all' ? ` (${getPhaseConfig(phaseFilter).label})` : ''}{searchQuery ? ` "${searchQuery}"` : ''}
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {filtered.map(p => {
        const expanded = expandedId === p.id;
        const phase = getPhaseConfig(p.phase);
        const hasMetrics = p.nitrogenT > 0 || p.extractionHa > 0 || p.afforestationHa > 0;

        return (
          <div key={p.id} className="border border-border rounded-lg overflow-hidden bg-card/50">
            <button
              onClick={() => onToggle(p.id)}
              className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${phase.dot}`} />
                  <span className="text-[11px] font-medium text-foreground truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className={phase.text}>{phase.label}</span>
                  {p.measureName && <span>· {p.measureName}</span>}
                  {hasMetrics && (
                    <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {p.nitrogenT > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" />
                          {formatDanishNumber(p.nitrogenT, 2)} t
                        </span>
                      )}
                      {p.extractionHa > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Mountain className="w-2.5 h-2.5" />
                          {formatDanishNumber(p.extractionHa, 1)} ha
                        </span>
                      )}
                      {p.afforestationHa > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Trees className="w-2.5 h-2.5" />
                          {formatDanishNumber(p.afforestationHa, 1)} ha
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2 text-[11px]">
                {/* Status & measure */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <span className={`font-medium ${phase.text}`}>{p.statusName || phase.label}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-medium text-foreground">{p.measureName || '—'}</span>
                  </div>
                  {p.areaHa > 0 && (
                    <div>
                      <span className="text-muted-foreground">Areal:</span>{' '}
                      <span className="font-medium text-foreground">{formatDanishNumber(p.areaHa, 1)} ha</span>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                {hasMetrics && (
                  <div className="flex flex-wrap gap-3">
                    {p.nitrogenT > 0 && (
                      <div className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-nature-water" />
                        <span className="text-muted-foreground">N-reduktion:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(p.nitrogenT, 3)} ton</span>
                      </div>
                    )}
                    {p.extractionHa > 0 && (
                      <div className="flex items-center gap-1">
                        <Mountain className="w-3 h-3 text-nature-earth" />
                        <span className="text-muted-foreground">Udtaget:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(p.extractionHa, 1)} ha</span>
                      </div>
                    )}
                    {p.afforestationHa > 0 && (
                      <div className="flex items-center gap-1">
                        <Trees className="w-3 h-3 text-primary" />
                        <span className="text-muted-foreground">Skov:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(p.afforestationHa, 1)} ha</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Scheme & dates */}
                <div className="space-y-1">
                  {p.schemeName && (
                    <div>
                      <span className="text-muted-foreground">Tilskudsordning:</span>{' '}
                      <span className="text-foreground">{p.schemeName}</span>
                      {p.schemeOrg && <span className="text-muted-foreground"> ({p.schemeOrg})</span>}
                    </div>
                  )}
                  <div className="flex gap-4">
                    {p.appliedAt && (
                      <div>
                        <span className="text-muted-foreground">Ansøgt:</span>{' '}
                        <span className="text-foreground">{formatDate(p.appliedAt)}</span>
                      </div>
                    )}
                    {p.lastChanged && (
                      <div>
                        <span className="text-muted-foreground">Senest opdateret:</span>{' '}
                        <span className="text-foreground">{formatDate(p.lastChanged)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mini-map for project polygon */}
                {p.geoId && geometries?.[p.geoId] && geometries[p.geoId].length >= 3 && (
                  <ProjectMiniMap
                    coordinates={geometries[p.geoId]}
                    height={160}
                    onClick={() => onOpenMap(geometries[p.geoId], {
                      name: p.name,
                      phase: p.phase,
                      phaseLabelDa: getPhaseConfig(p.phase).label,
                      measureName: p.measureName,
                      schemeName: p.schemeName,
                      schemeOrg: p.schemeOrg,
                      areaHa: p.areaHa,
                      nitrogenT: p.nitrogenT,
                      extractionHa: p.extractionHa,
                      afforestationHa: p.afforestationHa,
                    })}
                  />
                )}

                {/* External link */}
                {p.schemeUrl && (
                  <a
                    href={p.schemeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Se tilskudsordning
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SketchesTab({ sketches, expandedId, onToggle, geometries, searchQuery, onOpenMap }: {
  sketches: SketchProject[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  geometries: Record<string, [number, number][]> | null;
  searchQuery: string;
  onOpenMap: (coords: [number, number][], info: ProjectMapInfo) => void;
}) {
  const sorted = useMemo(() => {
    let list = sketches;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.measureName.toLowerCase().includes(q) ||
        s.schemeName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.nitrogenT - a.nitrogenT);
  }, [sketches, searchQuery]);

  if (sorted.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-3 text-center">
        Ingen skitser matcher{searchQuery ? ` "${searchQuery}"` : ''}
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {sorted.map(s => {
        const expanded = expandedId === s.id;
        const hasMetrics = s.nitrogenT > 0 || s.extractionHa > 0 || s.afforestationHa > 0;

        return (
          <div key={s.id} className="border border-border rounded-lg overflow-hidden bg-card/50">
            <button
              onClick={() => onToggle(s.id)}
              className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${getPhaseConfig('sketch').dot} flex-shrink-0`} />
                  <span className="text-[11px] font-medium text-foreground truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className={getPhaseConfig('sketch').text}>{getPhaseConfig('sketch').label}</span>
                  {s.measureName && <span>· {s.measureName}</span>}
                  {hasMetrics && (
                    <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {s.nitrogenT > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="w-2.5 h-2.5" />
                          {formatDanishNumber(s.nitrogenT, 2)} t
                        </span>
                      )}
                      {s.extractionHa > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Mountain className="w-2.5 h-2.5" />
                          {formatDanishNumber(s.extractionHa, 1)} ha
                        </span>
                      )}
                      {s.afforestationHa > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Trees className="w-2.5 h-2.5" />
                          {formatDanishNumber(s.afforestationHa, 1)} ha
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2 text-[11px]">
                {/* Type & area */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <span className={`font-medium ${getPhaseConfig('sketch').text}`}>{getPhaseConfig('sketch').label}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-medium text-foreground">{s.measureName || '—'}</span>
                  </div>
                  {s.areaHa > 0 && (
                    <div>
                      <span className="text-muted-foreground">Areal:</span>{' '}
                      <span className="font-medium text-foreground">{formatDanishNumber(s.areaHa, 1)} ha</span>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                {hasMetrics && (
                  <div className="flex flex-wrap gap-3">
                    {s.nitrogenT > 0 && (
                      <div className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-nature-water" />
                        <span className="text-muted-foreground">N-reduktion:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(s.nitrogenT, 3)} ton</span>
                      </div>
                    )}
                    {s.extractionHa > 0 && (
                      <div className="flex items-center gap-1">
                        <Mountain className="w-3 h-3 text-nature-earth" />
                        <span className="text-muted-foreground">Udtaget:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(s.extractionHa, 1)} ha</span>
                      </div>
                    )}
                    {s.afforestationHa > 0 && (
                      <div className="flex items-center gap-1">
                        <Trees className="w-3 h-3 text-primary" />
                        <span className="text-muted-foreground">Skov:</span>
                        <span className="font-semibold text-foreground">{formatDanishNumber(s.afforestationHa, 1)} ha</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Scheme */}
                {s.schemeName && (
                  <div>
                    <span className="text-muted-foreground">Tilskudsordning:</span>{' '}
                    <span className="text-foreground">{s.schemeName}</span>
                    {s.schemeOrg && <span className="text-muted-foreground"> ({s.schemeOrg})</span>}
                  </div>
                )}

                {/* Mini-map for sketch polygon */}
                {s.geoId && geometries?.[s.geoId] && geometries[s.geoId].length >= 3 && (
                  <ProjectMiniMap
                    coordinates={geometries[s.geoId]}
                    height={160}
                    onClick={() => onOpenMap(geometries![s.geoId], {
                      name: s.name,
                      phase: 'sketch',
                      phaseLabelDa: 'Skitse',
                      measureName: s.measureName,
                      schemeName: s.schemeName,
                      schemeOrg: s.schemeOrg,
                      areaHa: s.areaHa,
                      nitrogenT: s.nitrogenT,
                      extractionHa: s.extractionHa,
                      afforestationHa: s.afforestationHa,
                    })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NaturePotentialsTab({ potentials, expandedId, onToggle }: {
  potentials: NaturePotential[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const sorted = useMemo(() =>
    [...potentials].sort((a, b) => b.areaHa - a.areaHa),
    [potentials]
  );

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {sorted.map(np => {
        const expanded = expandedId === np.id;
        const hasBreakdown = np.biodiversityHa > 0 || np.natura2000Ha > 0 || np.section3Ha > 0 || np.protectedNatureHa > 0;

        return (
          <div key={np.id} className="border border-border rounded-lg overflow-hidden bg-card/50">
            <button
              onClick={() => onToggle(np.id)}
              className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Leaf className="w-3 h-3 flex-shrink-0" style={{ color: '#166534' }} />
                  <span className="text-[11px] font-medium text-foreground truncate">{np.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Naturpotentiale</span>
                  <span className="ml-auto font-semibold text-foreground flex-shrink-0">
                    {formatDanishNumber(np.areaHa, 0)} ha
                  </span>
                </div>
              </div>
            </button>

            {expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Samlet areal:</span>{' '}
                    <span className="font-semibold text-foreground">{formatDanishNumber(np.areaHa, 1)} ha</span>
                  </div>
                </div>

                {hasBreakdown && (
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-medium">Arealopdeling:</span>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {np.biodiversityHa > 0 && (
                        <div>
                          <span className="text-muted-foreground">Biodiversitet:</span>{' '}
                          <span className="font-semibold text-foreground">{formatDanishNumber(np.biodiversityHa, 0)} ha</span>
                        </div>
                      )}
                      {np.natura2000Ha > 0 && (
                        <div>
                          <span className="text-muted-foreground">Natura 2000:</span>{' '}
                          <span className="font-semibold text-foreground">{formatDanishNumber(np.natura2000Ha, 0)} ha</span>
                        </div>
                      )}
                      {np.section3Ha > 0 && (
                        <div>
                          <span className="text-muted-foreground">§3 beskyttet:</span>{' '}
                          <span className="font-semibold text-foreground">{formatDanishNumber(np.section3Ha, 0)} ha</span>
                        </div>
                      )}
                      {np.protectedNatureHa > 0 && (
                        <div>
                          <span className="text-muted-foreground">Beskyttet natur:</span>{' '}
                          <span className="font-semibold text-foreground">{formatDanishNumber(np.protectedNatureHa, 0)} ha</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
