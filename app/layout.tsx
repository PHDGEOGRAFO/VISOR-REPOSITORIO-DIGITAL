import type {Metadata} from "next"; import "./globals.css"; import "./spatial.css"; import "./map-gray.css";
export const metadata:Metadata={title:"Visor Repositorio Digital",description:"Catálogo, visor y análisis de coberturas territoriales de la comuna de Santiago.",icons:{icon:"/VISOR-REPOSITORIO-DIGITAL/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
