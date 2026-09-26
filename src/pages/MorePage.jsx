import Icon from "../components/ui/Icon";
import { List, ListRow } from "../components/ui/List";
import { PageHeader } from "../components/ui/Misc";
import { tabLayout } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";

// The phone tab bar's "More": everything that didn't fit in the bar.
export default function MorePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { overflow } = tabLayout(user);

  return (
    <div>
      <PageHeader title={t("nav.more")} />
      <List inset={52}>
        {overflow.map((item) => (
          <ListRow key={item.to} to={item.to} leading={<Icon name={item.icon} size={20} />} title={t(item.label)} />
        ))}
      </List>
    </div>
  );
}
