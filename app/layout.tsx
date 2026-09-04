import type {Metadata} from "next";
import "./globals.css";
import "./spatial.css";
import "./map-gray.css";
import "./recovery.css";
import "./floating-windows.css";
import "./source-note.css";
import "./responsive.css";
import "./responsive-header.css";
import FloatingWindows from "./FloatingWindows";
import TextEncodingRepair from "./TextEncodingRepair";
import GeoJsonSanitizer from "./GeoJsonSanitizer";
import MapUiEnhancements from "./MapUiEnhancements";

export const metadata:Metadata={
  title:"Visor Territorial · Municipalidad de Santiago",
  description:"Información territorial elaborada a partir de antecedentes proporcionados por direcciones y oficinas municipales, levantamientos propios, catastros, encuestas y otras fuentes afines.",
  icons:{icon:"/VISOR-REPOSITORIO-DIGITAL/favicon.svg"}
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><head><meta charSet="utf-8"/></head><body><GeoJsonSanitizer/><TextEncodingRepair/><FloatingWindows/><MapUiEnhancements/>{children}</body></html>;
}
