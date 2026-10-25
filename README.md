# Marvel vs DC — Fighter 2D

Protótipo gratuito de jogo de luta 2D para navegador, construído com TypeScript, Phaser 3 e Vite. A primeira etapa prioriza uma luta funcional 1v1 e uma arquitetura que possa evoluir para equipes 3v3.

## Requisitos
- Node.js 20 ou superior
- npm

## Executar localmente
```bash
npm install
npm run dev
```
Abra o endereço local exibido pelo Vite.

## Verificar e compilar
```bash
npm run typecheck
npm run build
npm run preview
```

## Controles
- A / D: mover
- W: pular
- J: ataque leve
- K: ataque pesado
- L: golpe especial
- Segurar S: defender
- R: reiniciar a luta

O protótipo usa lutadores desenhados proceduralmente como placeholders. Eles serão substituídos por spritesheets e animações originais/licenciadas em uma etapa artística posterior.

## Estado atual
Base inicial em desenvolvimento. Recursos de multiplayer online, seleção completa de personagens, modo 3v3 e sprites finais ainda não estão implementados.

## Publicação
O projeto gera arquivos estáticos na pasta `dist/`, compatíveis com hospedagens gratuitas para sites estáticos. Para GitHub Pages em um caminho de projeto, ajuste `base` em `vite.config.ts` para `/Marvel-Vs-DC-/` antes de compilar.

## Direitos
Este repositório é um protótipo técnico. Antes de distribuir publicamente uma versão que use personagens, nomes, logos, músicas ou artes de terceiros, confirme as permissões necessárias. Prefira arte original ou devidamente licenciada.