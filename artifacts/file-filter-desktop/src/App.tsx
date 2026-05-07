import { Suspense, lazy, useEffect, useState } from "react";
import type { DecodeSourceFile } from "./app/types";
import type { AppView } from "./app/types";
import type { NamingHeroMenuState } from "./app/types";
import { loadRuntimeNamingStandard, useNamingStandardVersion } from "./app/standard-config";
import {
  DecodingHeroMenu,
  FilterHeroMenu,
  NamingHeroMenu,
  StandardHeroMenu,
} from "./features/filter/components/FilterHeroMenu";
import { FilterView } from "./features/filter/FilterView";
import { useFilterWorkspace } from "./features/filter/useFilterWorkspace";

const NamingView = lazy(async () => {
  const module = await import("./NamingView");
  return { default: module.NamingView };
});

const DecodingView = lazy(async () => {
  const module = await import("./DecodingView");
  return { default: module.DecodingView };
});

const StandardView = lazy(async () => {
  const module = await import("./StandardView");
  return { default: module.StandardView };
});

function EkoinbudLogo() {
  return (
    <svg
      className="hero-logo-mark"
      xmlns="http://www.w3.org/2000/svg"
      width="262"
      height="41.385"
      viewBox="0 0 262 41.385"
      role="img"
      aria-label="Ekoinbud"
    >
      <g id="logo" transform="translate(-38.374 -322.2)">
        <path
          id="Path_1"
          data-name="Path 1"
          d="M195.162,324.748c2.565-.824,5.131-1.647,7.7-2.448a18.468,18.468,0,0,1-.377,2.283c-.918,5.131-1.789,10.261-2.707,15.392-.235,1.412-.541,2.824-.73,4.26.188.024.306-.165.471-.259,3.671-2.636,7.319-5.272,10.991-7.908,1.012-.753,2.048-1.436,3.036-2.212,3.742-.024,7.484.024,11.226-.024-.635.565-1.365.988-2.024,1.506l-19.134,13.768c-.094.094-.329.141-.259.329,6,4.519,11.979,9.061,17.981,13.556a5.753,5.753,0,0,0,.73.518v.141c-3.46-.024-6.919,0-10.379,0-.188-.024-.4.047-.541-.094-4.519-3.413-9.061-6.849-13.58-10.261H197.4c-.518,3.013-1.059,6.049-1.577,9.061a7.92,7.92,0,0,1-.282,1.294h-6.9c-.141,0-.447.071-.377-.165q3.248-18.569,6.543-37.139a8.372,8.372,0,0,1,.353-1.6"
          transform="translate(-114.607 -0.076)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_2"
          data-name="Path 2"
          d="M698.839,340.352a4.675,4.675,0,0,0-2.471.988,4.23,4.23,0,0,0-1.271,1.977l-1.695,9.6a3.783,3.783,0,0,0,.965,3.436,3.641,3.641,0,0,0,2.542.871h9.061a4.1,4.1,0,0,0,3.012-1.059,8.023,8.023,0,0,0,1.624-3.719c.447-2.377.847-4.731,1.271-7.108.118-1.294.377-2.73-.282-3.93a3.069,3.069,0,0,0-2.707-1.106c-2.118-.024-4.26,0-6.378,0-1.247,0-2.471-.047-3.672.047m-7.672-15.627c2.542-.8,5.06-1.647,7.6-2.424-.094,1.083-.377,2.165-.518,3.248-.494,2.777-1.012,5.554-1.459,8.355,3.248,0,6.472-.024,9.72,0a35.91,35.91,0,0,1,7.461.4,7.512,7.512,0,0,1,3.766,1.93,7.241,7.241,0,0,1,1.789,5.3,41.484,41.484,0,0,1-.965,7.6,36.282,36.282,0,0,1-1.718,7.225,10.7,10.7,0,0,1-3.766,5.084,13.41,13.41,0,0,1-7.272,2.142c-6.237.024-12.45,0-18.687,0-.965-.024-1.953.024-2.918-.024.118-1.153.377-2.33.565-3.483q3.071-17.475,6.166-34.9c.071-.141.024-.4.235-.447"
          transform="translate(-493.83 -0.076)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_3"
          data-name="Path 3"
          d="M1005.634,340.275a3.78,3.78,0,0,0-2.565,1.341,12.37,12.37,0,0,0-1.695,5.131c-.259,1.483-.518,2.965-.8,4.448a12.433,12.433,0,0,0-.212,3.954,2.11,2.11,0,0,0,1.036,1.506,4.82,4.82,0,0,0,2.142.471h8.826a5.028,5.028,0,0,0,2.659-.73,5.859,5.859,0,0,0,2.212-2.942c.424-2.448.847-4.872,1.294-7.319.118-1.012.4-2,.518-3.036a2.824,2.824,0,0,0-.871-2.189,4.542,4.542,0,0,0-2.754-.73h-6.378c-1.153.047-2.283,0-3.413.094m16.663-15.58c2.612-.847,5.225-1.695,7.861-2.495q-3.6,20.37-7.178,40.763a1.328,1.328,0,0,1-.165.541c-5.86.047-11.7,0-17.557.024-2.612-.024-5.3.188-7.814-.612a6.72,6.72,0,0,1-3.2-2.048,7.128,7.128,0,0,1-1.389-3.742,27.54,27.54,0,0,1,.753-7.837,53.979,53.979,0,0,1,1.6-7.461,11.937,11.937,0,0,1,3.036-5.037,10.813,10.813,0,0,1,5.79-2.683,25.679,25.679,0,0,1,4.448-.282c4.072,0,8.12-.024,12.191,0,.306-1.2.447-2.448.683-3.671.306-1.836.682-3.648.941-5.46"
          transform="translate(-729.784)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_4"
          data-name="Path 4"
          d="M506.489,327.1c2.471.024,4.966,0,7.437,0-.424,2.589-.918,5.178-1.365,7.767-.024.212-.282.118-.4.141H505.1c.424-2.659.918-5.272,1.389-7.908"
          transform="translate(-356.881 -3.747)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_5"
          data-name="Path 5"
          d="M49.3,378.682a4.369,4.369,0,0,0-1.53,2.377,29.865,29.865,0,0,0-.588,3.224,2.2,2.2,0,0,0,.565.047c5.766-.024,11.556.024,17.345-.024a4.452,4.452,0,0,0,.259-1.106,8.282,8.282,0,0,0,.094-3.719,1.95,1.95,0,0,0-.988-1.13,6.045,6.045,0,0,0-2.824-.424h-9.3a4.89,4.89,0,0,0-3.036.753m1.906-7.084a32.84,32.84,0,0,1,4.025-.118H60.6c2.518.024,5.107-.141,7.531.659a6.758,6.758,0,0,1,4.4,3.554,11.155,11.155,0,0,1,.329,6.566c-.424,2.236-.753,4.472-1.224,6.684-8.1.024-16.192,0-24.265,0a8.317,8.317,0,0,0-1.083.024,19.685,19.685,0,0,0-.4,3.107,2.368,2.368,0,0,0,.706,1.93,4.035,4.035,0,0,0,2.589.8H69.964c.118.118-.024.306-.047.447-.659,1.953-1.247,3.977-1.953,5.907-5.954.047-11.932,0-17.887.024a26.945,26.945,0,0,1-5.154-.259,8.744,8.744,0,0,1-4.9-2.377,6.4,6.4,0,0,1-1.577-3.671,14.376,14.376,0,0,1,.188-4.142c.471-2.754.988-5.531,1.459-8.284a14.855,14.855,0,0,1,2.448-6.5,10.242,10.242,0,0,1,4.4-3.318,16.816,16.816,0,0,1,4.26-1.036"
          transform="translate(0 -37.677)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_6"
          data-name="Path 6"
          d="M342.922,377.972a4.013,4.013,0,0,0-2.636,1.271,7.642,7.642,0,0,0-1.271,3.719c-.282,1.742-.635,3.46-.894,5.178-.212.73-.212,1.506-.424,2.236a5.332,5.332,0,0,0,.094,3.154,1.986,1.986,0,0,0,1.083.965,5.624,5.624,0,0,0,2.259.353H351.3a4.155,4.155,0,0,0,3.46-1.624,9.163,9.163,0,0,0,1.059-3.413l1.271-7.2a10.3,10.3,0,0,0,.235-1.906,2.483,2.483,0,0,0-.659-2,3.822,3.822,0,0,0-2.565-.777c-1.906-.024-3.813,0-5.719,0-1.836.024-3.648-.071-5.46.047m.447-6.4c1.436-.118,2.895-.047,4.33-.071h7.72a16.48,16.48,0,0,1,5.342.847,5.9,5.9,0,0,1,3.06,2.306,7.644,7.644,0,0,1,1.036,4.26,31.2,31.2,0,0,1-.635,5.131c-.306,1.459-.518,2.942-.8,4.425a36.224,36.224,0,0,1-1.012,4.8,10.5,10.5,0,0,1-4.33,6.1,15.664,15.664,0,0,1-8.379,1.859h-9.626a17.045,17.045,0,0,1-5.554-.659,6.861,6.861,0,0,1-3.06-1.859,6.47,6.47,0,0,1-1.459-4,28.554,28.554,0,0,1,.706-6.472c.353-1.93.683-3.836,1.036-5.766a17.842,17.842,0,0,1,1.6-5.248,9.387,9.387,0,0,1,3.719-4,15.036,15.036,0,0,1,6.307-1.647"
          transform="translate(-222.969 -37.697)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_7"
          data-name="Path 7"
          d="M486.248,371.512c1.93-.047,3.883,0,5.813-.024a10.967,10.967,0,0,1,1.53.047c-1.6,9.179-3.248,18.357-4.848,27.536-.165.706-.188,1.459-.424,2.165-2.448,0-4.9-.024-7.319,0a19.129,19.129,0,0,1,.306-1.977q2.295-12.921,4.566-25.865a17.758,17.758,0,0,1,.377-1.883"
          transform="translate(-338.453 -37.686)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_8"
          data-name="Path 8"
          d="M536.131,371.513c.988-.094,2-.024,3.013-.047,5.248-.024,10.52,0,15.769,0a21.344,21.344,0,0,1,7.319.777,5.908,5.908,0,0,1,3.036,2.236,7.38,7.38,0,0,1,1.2,3.624,21.915,21.915,0,0,1-.212,4.472c-.871,5.154-1.836,10.285-2.707,15.439-.212,1.059-.353,2.142-.588,3.2-2.448-.024-4.9-.024-7.319,0a5.463,5.463,0,0,1,.165-1.224c.941-5.319,1.883-10.661,2.824-15.98a14.089,14.089,0,0,0,.4-3.836,2.542,2.542,0,0,0-.871-1.718,4.7,4.7,0,0,0-2.636-.612H546.58a6.012,6.012,0,0,0-2.424.353,4.618,4.618,0,0,0-2,2.024,6.258,6.258,0,0,0-.494,1.977c-1.036,5.907-2.095,11.791-3.107,17.7a7.927,7.927,0,0,1-.282,1.294h-7.013c-.071-.024-.188-.047-.259-.071.353-2.236.777-4.472,1.153-6.708,1.271-7.6,2.636-15.251,3.977-22.9"
          transform="translate(-376.686 -37.663)"
          fill="#fff"
          fillRule="evenodd"
        />
        <path
          id="Path_9"
          data-name="Path 9"
          d="M846.768,371.595c1.294-.071,2.612,0,3.907-.024,1.13,0,2.236-.024,3.366.024a4.085,4.085,0,0,1-.118.918c-.941,5.248-1.859,10.52-2.777,15.769a19.944,19.944,0,0,0-.494,3.907,2.545,2.545,0,0,0,1.13,2.259,5.486,5.486,0,0,0,2.824.471h8.284a4,4,0,0,0,2.918-1.247,4.216,4.216,0,0,0,1.224-2.236c1.153-6.59,2.33-13.18,3.483-19.793.988-.094,2-.024,2.989-.047,1.459,0,2.918-.024,4.378.024-.071.941-.306,1.859-.447,2.8l-4.731,26.83a2.678,2.678,0,0,1-.871.047H852.369a15.835,15.835,0,0,1-3.789-.4,7.9,7.9,0,0,1-3.06-1.412,6,6,0,0,1-2.024-3.248,13.623,13.623,0,0,1-.282-4.142c.259-2.495.8-4.919,1.2-7.39.471-2.589.918-5.2,1.389-7.79.329-1.789.588-3.577.965-5.319"
          transform="translate(-615.399 -37.745)"
          fill="#fff"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

function AppReady() {
  useNamingStandardVersion();
  const [activeView, setActiveView] = useState<AppView>("filter");
  const [decodeSeedFiles, setDecodeSeedFiles] = useState<DecodeSourceFile[]>([]);
  const [decodeSeedToken, setDecodeSeedToken] = useState(0);
  const [decodingDictionaryPath, setDecodingDictionaryPath] = useState("");
  const [refreshDecodingDictionaryToken, setRefreshDecodingDictionaryToken] = useState(0);
  const [openDecodingTemplateManagerToken, setOpenDecodingTemplateManagerToken] = useState(0);
  const [refreshNamingWorkingFolderToken, setRefreshNamingWorkingFolderToken] = useState(0);
  const [undoNamingOperationToken, setUndoNamingOperationToken] = useState(0);
  const [standardAdminMode, setStandardAdminMode] = useState(false);
  const [namingHeroMenuState, setNamingHeroMenuState] = useState<NamingHeroMenuState>({
    canRefreshWorkingFolder: false,
    refreshWorkingFolderLabel: "Odśwież folder roboczy",
    canUndoLastOperation: false,
  });
  const workspace = useFilterWorkspace();
  const favoriteProjectsCount = workspace.visibleFavoriteProjects.length;
  const favoriteLayoutClass = `favorite-count-${Math.min(favoriteProjectsCount, 10)}`;

  function openDecodingView(files: DecodeSourceFile[]) {
    setDecodeSeedFiles(files);
    setDecodeSeedToken((current) => current + 1);
    setActiveView("decoding");
  }

  const hasHeroMenu = true;

  return (
    <div className="app-shell">
      <header className="hero-bar">
        <div className="hero-brand">
          <div className="hero-brand-copy">
            <div className="hero-brand-header">
              <div className="hero-menu-slot" aria-hidden={!hasHeroMenu}>
                {activeView === "filter" ? (
                  <FilterHeroMenu
                    canExportReport={Boolean(workspace.scanResult && (workspace.scanResult.invalidCount ?? 0) > 0 && !workspace.exportingInvalidReport)}
                    exportLabel={workspace.exportingInvalidReport ? "Eksportowanie raportu..." : "Raport plików"}
                    onChooseRoot={() => void workspace.handleChooseRoot()}
                    onExportReport={() => void workspace.handleExportInvalidFilesReport()}
                  />
                ) : activeView === "decoding" ? (
                  <DecodingHeroMenu
                    dictionaryPath={decodingDictionaryPath}
                    onEditDictionary={() => void window.fileFilterApi.openFile(decodingDictionaryPath)}
                    onRefreshDictionary={() => setRefreshDecodingDictionaryToken((current) => current + 1)}
                    onManageTemplates={() => setOpenDecodingTemplateManagerToken((current) => current + 1)}
                  />
                ) : activeView === "naming" ? (
                  <NamingHeroMenu
                    canRefreshWorkingFolder={namingHeroMenuState.canRefreshWorkingFolder}
                    refreshWorkingFolderLabel={namingHeroMenuState.refreshWorkingFolderLabel}
                    canUndoLastOperation={namingHeroMenuState.canUndoLastOperation}
                    onRefreshWorkingFolder={() => setRefreshNamingWorkingFolderToken((current) => current + 1)}
                    onUndoLastOperation={() => setUndoNamingOperationToken((current) => current + 1)}
                  />
                ) : activeView === "standard" ? (
                  <StandardHeroMenu
                    isAdminMode={standardAdminMode}
                    onToggleAdminMode={() => setStandardAdminMode((current) => !current)}
                  />
                ) : null}
              </div>
              <p className="hero-subtitle">Filtr plików projektowych</p>
            </div>
            <EkoinbudLogo />
          </div>
        </div>

        {activeView === "filter" ? (
          <div className={`hero-favorites ${favoriteLayoutClass}`.trim()} aria-label="Ulubione projekty">
            {workspace.visibleFavoriteProjects.map((favoriteProject) => (
              <button
                key={favoriteProject.projectName}
                type="button"
                className={`favorite-project-card ${
                  favoriteProject.projectName === workspace.selectedProject ? "active" : ""
                }`}
                onClick={() => void workspace.handleProjectSelect(favoriteProject.projectName)}
              >
                <strong>{favoriteProject.number}</strong>
                <span>{favoriteProject.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="hero-spacer" aria-hidden="true" />
        )}

        <div className="hero-actions">
          <button
            className={`secondary-button ${activeView === "filter" ? "active" : ""}`}
            onClick={() => setActiveView("filter")}
          >
            Filtruj
          </button>
          <button
            className={`secondary-button ${activeView === "naming" ? "active" : ""}`}
            onClick={() => setActiveView("naming")}
          >
            Nazwij
          </button>
          <button
            className={`secondary-button ${activeView === "decoding" ? "active" : ""}`}
            onClick={() => setActiveView("decoding")}
          >
            Odkoduj
          </button>
          <button
            className={`secondary-button ${activeView === "standard" ? "active" : ""}`}
            onClick={() => setActiveView("standard")}
          >
            Standard
          </button>
        </div>
      </header>

      <div className={`app-content-scroll ${activeView === "filter" ? "filter-view-scroll" : ""}`}>
        {activeView === "filter" ? (
          <FilterView
            workspace={workspace}
            onDecodeSelected={() => openDecodingView(workspace.selectedFiles)}
          />
        ) : activeView === "naming" ? (
          <Suspense
            fallback={
              <div className="empty-state empty-state-compact">
                <h3>Ładowanie widoku nazewnictwa...</h3>
              </div>
            }
          >
            <NamingView
              selectedProjectName={workspace.selectedProject}
              refreshWorkingFolderRequestToken={refreshNamingWorkingFolderToken}
              undoLastOperationRequestToken={undoNamingOperationToken}
              onHeroMenuStateChange={setNamingHeroMenuState}
            />
          </Suspense>
        ) : activeView === "decoding" ? (
          <Suspense
            fallback={
              <div className="empty-state empty-state-compact">
                <h3>Ładowanie widoku odkodowania...</h3>
              </div>
            }
          >
            <DecodingView
              initialFiles={decodeSeedFiles}
              launchToken={decodeSeedToken}
              dictionaryRefreshToken={refreshDecodingDictionaryToken}
              onDictionaryPathChange={setDecodingDictionaryPath}
              manageTemplatesRequestToken={openDecodingTemplateManagerToken}
            />
          </Suspense>
        ) : (
          <Suspense
            fallback={
              <div className="empty-state empty-state-compact">
                <h3>Ładowanie widoku standardu...</h3>
              </div>
            }
          >
            <StandardView isAdminMode={standardAdminMode} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export function App() {
  const [standardReady, setStandardReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadRuntimeNamingStandard()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setStandardReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!standardReady) {
    return (
      <div className="app-shell">
        <div className="empty-state empty-state-compact">
          <h3>Ładowanie standardu...</h3>
        </div>
      </div>
    );
  }

  return <AppReady />;
}
