import { Link, useRouterState } from "@tanstack/react-router";
import { BookMarked, ChevronRight } from "lucide-react";
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildNavTree, findPage, type NavNode } from "@/lib/content";

const logoLight = `${import.meta.env.BASE_URL}assets/lumi-logo-light.svg`;
const logoDark = `${import.meta.env.BASE_URL}assets/lumi-logo-dark.svg`;

function slugToHref(slug: string) {
  return slug === "" ? "/" : `/${slug}`;
}

export function AppSidebar() {
  const tree = React.useMemo(() => buildNavTree(), []);
  const glossary = React.useMemo(() => findPage("glossary"), []);
  const pathname = useRouterState({
    // Strip the trailing slash (trailingSlash: "always") so comparisons
    // against slug-derived hrefs like "/Chapter_2" keep matching.
    select: (s) => s.location.pathname.replace(/\/+$/, "") || "/",
  });

  return (
    <Sidebar>
      <SidebarHeader className="h-14 flex-row items-center border-b border-sidebar-border px-3 py-0">
        <Link to="/" className="block w-full">
          <img src={logoLight} alt="LUMI AI Factory" className="w-full h-auto block dark:hidden" />
          <img src={logoDark} alt="LUMI AI Factory" className="w-full h-auto hidden dark:block" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {tree.map((node) => (
                <NavItem key={node.page.slug} node={node} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {glossary && (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={pathname === "/glossary"}
                className="text-sidebar-foreground/70 data-[active=true]:text-sidebar-foreground"
              >
                <Link to="/glossary">
                  <BookMarked className="h-3.5 w-3.5" />
                  <span>{glossary.frontmatter.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

function isActiveTree(node: NavNode, pathname: string): boolean {
  if (slugToHref(node.page.slug) === pathname) return true;
  return node.children.some((c) => isActiveTree(c, pathname));
}

function NavItem({ node, pathname }: { node: NavNode; pathname: string }) {
  const href = slugToHref(node.page.slug);
  const active = pathname === href;

  if (node.children.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          className="h-auto min-h-8 py-1.5 [&>span:last-child]:whitespace-normal [&>span:last-child]:truncate-none"
        >
          <Link to={href}>
            <span className="whitespace-normal leading-snug">{node.page.frontmatter.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const branchActive = isActiveTree(node, pathname);

  return (
    <Collapsible defaultOpen={branchActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={active}>
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            <span>{node.page.frontmatter.title}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild isActive={active}>
                <Link to={href}>Overview</Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            {node.children.map((child) => {
              const childHref = slugToHref(child.page.slug);
              return (
                <SidebarMenuSubItem key={child.page.slug}>
                  <SidebarMenuSubButton asChild isActive={pathname === childHref}>
                    <Link to={childHref}>{child.page.frontmatter.title}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
