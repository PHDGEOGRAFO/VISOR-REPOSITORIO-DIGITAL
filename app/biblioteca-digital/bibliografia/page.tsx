import styles from "../biblioteca.module.css";

const BASE_PATH = "/VISOR-REPOSITORIO-DIGITAL";

const documents = [
  {
    title: "PLADECO Santiago 2024–2034",
    meta: "Plan de Desarrollo Comunal",
    description: "Documento marco para la planificación comunal y seguimiento de lineamientos estratégicos.",
    href: "https://www.munistgo.cl/pladeco/",
    active: true,
  },
  {
    title: "Guía de Criterios de Sustentabilidad",
    meta: "Guía técnica",
    description: "Documento de apoyo para incorporar criterios de sustentabilidad en iniciativas y procesos de planificación.",
    href: "",
    active: false,
  },
  {
    title: "PLADETUR",
    meta: "Plan de Desarrollo Turístico",
    description: "Documento de planificación turística comunal.",
    href: "",
    active: false,
  },
  {
    title: "PDT Barriales",
    meta: "Planes de Desarrollo Territorial",
    description: "Documentación territorial asociada a los procesos de planificación barrial.",
    href: "",
    active: false,
  },
  {
    title: "Plan de Infraestructura Verde",
    meta: "Planificación ambiental y urbana",
    description: "Documento asociado a la planificación e infraestructura verde comunal.",
    href: "",
    active: false,
  },
];

export default function BibliografiaPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <a className={styles.back} href={`${BASE_PATH}/biblioteca-digital/`}>← Biblioteca Digital</a>

        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Biblioteca Digital</p>
            <h1 className={styles.title}>Repositorio de Bibliografía</h1>
            <p className={styles.lead}>
              Planes, estudios, guías y documentación técnica vinculada al territorio y a la planificación comunal.
            </p>
          </div>
        </div>

        <section className={styles.repoGrid} aria-label="Documentos de bibliografía">
          {documents.map((document) => (
            <article className={styles.repoCard} key={document.title}>
              <h2 className={styles.repoTitle}>{document.title}</h2>
              <p className={styles.repoMeta}>{document.meta}</p>
              <p className={styles.repoText}>{document.description}</p>
              {document.active ? (
                <a className={styles.activeLink} href={document.href} target="_blank" rel="noreferrer">
                  Consultar documento ↗
                </a>
              ) : (
                <span className={styles.pending}>Enlace pendiente / no habilitado</span>
              )}
            </article>
          ))}
        </section>

        <div className={styles.note}>
          El repositorio se irá habilitando progresivamente. Los documentos sin enlace confirmado se mantienen visibles
          como parte de la estructura, pero no permiten navegación ni descarga.
        </div>
      </div>
    </main>
  );
}
