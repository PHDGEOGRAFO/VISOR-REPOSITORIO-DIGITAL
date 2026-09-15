import CoverageSearch from "./CoverageSearch";
import styles from "./biblioteca.module.css";

const BASE_PATH = "/VISOR-REPOSITORIO-DIGITAL";

export default function BibliotecaDigitalPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <p className={styles.eyebrow}>Subdirección de Planificación y Sustentabilidad</p>
        <h1 className={styles.title}>Biblioteca Digital</h1>
        <p className={styles.lead}>
          Acceso institucional a información territorial y documentación técnica de apoyo a la planificación.
          Busca directamente una cobertura o selecciona uno de los dos repositorios.
        </p>

        <CoverageSearch />

        <section className={styles.cards} aria-label="Repositorios de Biblioteca Digital">
          <a className={styles.card} href={`${BASE_PATH}/`}>
            <div className={styles.icon} aria-hidden="true">⌖</div>
            <p className={styles.cardKicker}>Coberturas territoriales</p>
            <h2 className={styles.cardTitle}>Repositorio Territorial de Coberturas GIS / GeoPackage</h2>
            <p className={styles.cardText}>
              Consulta, visualiza y descarga coberturas territoriales vigentes e históricas organizadas por dimensión,
              temática y año.
            </p>
            <span className={styles.cardAction}>Ingresar al repositorio →</span>
          </a>

          <a className={styles.card} href={`${BASE_PATH}/biblioteca-digital/bibliografia/`}>
            <div className={styles.icon} aria-hidden="true">▤</div>
            <p className={styles.cardKicker}>Documentación técnica</p>
            <h2 className={styles.cardTitle}>Repositorio de Bibliografía</h2>
            <p className={styles.cardText}>
              Consulta planes, estudios, guías y documentos institucionales vinculados al territorio y a la
              planificación comunal.
            </p>
            <span className={styles.cardAction}>Ingresar a bibliografía →</span>
          </a>
        </section>
      </div>
    </main>
  );
}
