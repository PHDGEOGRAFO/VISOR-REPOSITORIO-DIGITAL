import type {Metadata} from "next";
import "./globals.css";
import "./spatial.css";
import "./map-gray.css";
import "./recovery.css";
import "./floating-windows.css";
import FloatingWindows from "./FloatingWindows";
import TextEncodingRepair from "./TextEncodingRepair";

export const metadata:Metadata={
  title:"Visor Territorial · Municipalidad de Santiago",
  description:"Repositorio Territorial Digital y análisis de coberturas de la comuna de Santiago.",
  icons:{icon:"/VISOR-REPOSITORIO-DIGITAL/favicon.svg"}
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="es"><head><meta charSet="utf-8"/></head><body><TextEncodingRepair/><FloatingWindows/>{children}</body></html>;
}
