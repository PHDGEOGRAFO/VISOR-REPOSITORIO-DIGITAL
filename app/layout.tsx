import type {Metadata} from "next"; import "./globals.css"; import "./spatial.css"; import "./map-gray.css"; import "./recovery.css";
export const metadata:Metadata={title:"Visor Territorial · Municipalidad de Santiago",description:"Repositorio Territorial Digital y análisis de coberturas de la comuna de Santiago.",icons:{icon:"/VISOR-REPOSITORIO-DIGITAL/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
