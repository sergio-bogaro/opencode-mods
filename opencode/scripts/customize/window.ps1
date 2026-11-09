# Janela do /customize-opencode: window.ps1 <state.json>
# Lê o estado que o mod escreve e manda cada mudança de volta, um JSON por linha, na saída padrão.
param([string]$StateFile = '', [switch]$Check)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Drawing
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Send($obj) {
    [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 10))
    [Console]::Out.Flush()
}

function NewBrush([string]$hex) {
    $b = New-Object System.Windows.Media.SolidColorBrush ([System.Windows.Media.ColorConverter]::ConvertFromString($hex)); $b.Freeze(); $b
}
$Brush = @{ Text = NewBrush '#EEEEEE'; Subtle = NewBrush '#808080'; Accent = NewBrush '#9D7CD8'; Border = NewBrush '#484848'
    Card = NewBrush '#141414'; Bg = NewBrush '#0A0A0A'; BgHigh = NewBrush '#1E1E1E'; Ok = NewBrush '#7FD88F'; Err = NewBrush '#E06C75'
    Warn = NewBrush '#F5A742'; OnAccent = NewBrush '#0A0A0A' }

[xml]$Xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="OpenCode · Customizar" Width="680" Height="860" MinWidth="560" MinHeight="520"
        Topmost="True" WindowStartupLocation="CenterScreen"
        Background="{DynamicResource Bg}" Foreground="{DynamicResource Text}" FontFamily="Cascadia Mono, Consolas, Segoe UI" FontSize="12">
  <Window.Resources>
    <SolidColorBrush x:Key="Bg" Color="#0A0A0A"/>
    <SolidColorBrush x:Key="BgRaised" Color="#141414"/>
    <SolidColorBrush x:Key="BgHigh" Color="#1E1E1E"/>
    <SolidColorBrush x:Key="Border" Color="#484848"/>
    <SolidColorBrush x:Key="Text" Color="#EEEEEE"/>
    <SolidColorBrush x:Key="Muted" Color="#808080"/>
    <SolidColorBrush x:Key="Accent" Color="#9D7CD8"/>
    <SolidColorBrush x:Key="AccentAlt" Color="#FAB283"/>
    <SolidColorBrush x:Key="Ok" Color="#7FD88F"/>
    <SolidColorBrush x:Key="Err" Color="#E06C75"/>
    <SolidColorBrush x:Key="Warn" Color="#F5A742"/>
    <SolidColorBrush x:Key="Selection" Color="#241E33"/>
    <SolidColorBrush x:Key="OnAccent" Color="#0A0A0A"/>
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="{DynamicResource Text}"/>
      <Setter Property="Background" Value="{DynamicResource BgHigh}"/>
      <Setter Property="BorderBrush" Value="{DynamicResource Border}"/>
      <Setter Property="Padding" Value="10,4"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="b" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="1" CornerRadius="2" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="BorderBrush" Value="{DynamicResource Accent}"/></Trigger>
              <Trigger Property="IsPressed" Value="True"><Setter TargetName="b" Property="Background" Value="{DynamicResource Border}"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.45"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="CheckBox">
      <Setter Property="Foreground" Value="{DynamicResource Text}"/>
      <Setter Property="VerticalAlignment" Value="Center"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="CheckBox">
            <StackPanel Orientation="Horizontal">
              <Border x:Name="box" Width="14" Height="14" Background="{DynamicResource BgHigh}" BorderBrush="{DynamicResource Border}"
                      BorderThickness="1" CornerRadius="2" VerticalAlignment="Center">
                <Path x:Name="check" Data="M 2 7 L 5 10 L 11 3" Stroke="{DynamicResource OnAccent}" StrokeThickness="2"
                      Visibility="Collapsed" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <ContentPresenter Margin="6,0,0,0" VerticalAlignment="Center"/>
            </StackPanel>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="box" Property="Background" Value="{DynamicResource Accent}"/>
                <Setter TargetName="box" Property="BorderBrush" Value="{DynamicResource Accent}"/>
                <Setter TargetName="check" Property="Visibility" Value="Visible"/>
              </Trigger>
              <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="box" Property="BorderBrush" Value="{DynamicResource Accent}"/></Trigger>
              <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="box" Property="BorderBrush" Value="{DynamicResource Accent}"/></Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.45"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="TextBox">
      <Setter Property="Background" Value="{DynamicResource BgHigh}"/><Setter Property="Foreground" Value="{DynamicResource Text}"/>
      <Setter Property="BorderBrush" Value="{DynamicResource Border}"/><Setter Property="CaretBrush" Value="{DynamicResource Text}"/>
      <Setter Property="Padding" Value="6,3"/><Setter Property="BorderThickness" Value="1"/>
      <Style.Triggers>
        <Trigger Property="IsKeyboardFocused" Value="True"><Setter Property="BorderBrush" Value="{DynamicResource Accent}"/></Trigger>
      </Style.Triggers>
    </Style>
    <Style TargetType="ComboBox">
      <Setter Property="Foreground" Value="{DynamicResource Text}"/><Setter Property="Background" Value="{DynamicResource BgHigh}"/>
      <Setter Property="BorderBrush" Value="{DynamicResource Border}"/><Setter Property="MinWidth" Value="150"/>
      <Setter Property="SnapsToDevicePixels" Value="True"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ComboBox">
            <Grid>
              <ToggleButton x:Name="toggleButton" Focusable="False" ClickMode="Press"
                            Background="{DynamicResource BgHigh}" BorderBrush="{DynamicResource Border}" BorderThickness="1"
                            IsChecked="{Binding IsDropDownOpen, Mode=TwoWay, RelativeSource={RelativeSource TemplatedParent}}">
                <ToggleButton.Template>
                  <ControlTemplate TargetType="ToggleButton">
                    <Border x:Name="b" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}"
                            BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="2">
                      <Path x:Name="arrow" Data="M 0 0 L 4 4 L 8 0" Stroke="{DynamicResource Muted}" StrokeThickness="1.5"
                            HorizontalAlignment="Right" VerticalAlignment="Center" Margin="0,0,8,0"/>
                    </Border>
                    <ControlTemplate.Triggers>
                      <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="b" Property="BorderBrush" Value="{DynamicResource Accent}"/></Trigger>
                    </ControlTemplate.Triggers>
                  </ControlTemplate>
                </ToggleButton.Template>
              </ToggleButton>
              <ContentPresenter x:Name="ContentSite" IsHitTestVisible="False" Margin="8,4,26,4" VerticalAlignment="Center"
                                HorizontalAlignment="Left" Content="{TemplateBinding SelectionBoxItem}"
                                ContentTemplate="{TemplateBinding SelectionBoxItemTemplate}"/>
              <TextBox x:Name="PART_EditableTextBox" Visibility="Collapsed" Margin="6,2,26,2" VerticalContentAlignment="Center"
                       Background="{DynamicResource BgHigh}" Foreground="{DynamicResource Text}" BorderThickness="0" CaretBrush="{DynamicResource Text}"/>
              <Popup x:Name="PART_Popup" Placement="Bottom" AllowsTransparency="True" Focusable="False" PopupAnimation="Slide"
                     IsOpen="{TemplateBinding IsDropDownOpen}" MaxHeight="{TemplateBinding MaxDropDownHeight}"
                     MinWidth="{Binding ActualWidth, RelativeSource={RelativeSource TemplatedParent}}">
                <Border Background="{DynamicResource BgHigh}" BorderBrush="{DynamicResource Border}" BorderThickness="1" CornerRadius="2" Margin="0,2,0,0">
                  <ScrollViewer MaxHeight="{TemplateBinding MaxDropDownHeight}">
                    <ItemsPresenter KeyboardNavigation.DirectionalNavigation="Contained"/>
                  </ScrollViewer>
                </Border>
              </Popup>
            </Grid>
            <ControlTemplate.Triggers>
              <Trigger Property="IsEditable" Value="True">
                <Setter TargetName="PART_EditableTextBox" Property="Visibility" Value="Visible"/>
                <Setter TargetName="ContentSite" Property="Visibility" Value="Collapsed"/>
              </Trigger>
              <Trigger Property="IsKeyboardFocusWithin" Value="True">
                <Setter TargetName="toggleButton" Property="BorderBrush" Value="{DynamicResource Accent}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.45"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="ComboBoxItem">
      <Setter Property="Foreground" Value="{DynamicResource Text}"/><Setter Property="Background" Value="{DynamicResource BgHigh}"/><Setter Property="Padding" Value="8,4"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ComboBoxItem">
            <Border x:Name="b" Background="{TemplateBinding Background}" Padding="{TemplateBinding Padding}">
              <ContentPresenter/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsHighlighted" Value="True"><Setter TargetName="b" Property="Background" Value="{DynamicResource Border}"/></Trigger>
              <Trigger Property="IsSelected" Value="True"><Setter TargetName="b" Property="Background" Value="{DynamicResource Selection}"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="Slider">
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Slider">
            <Grid Margin="0,4,0,4">
              <Border Height="4" CornerRadius="2" Background="{DynamicResource Border}" VerticalAlignment="Center"/>
              <Track x:Name="PART_Track" Orientation="Horizontal">
                <Track.DecreaseRepeatButton>
                  <RepeatButton Command="{x:Static Slider.DecreaseLarge}" BorderThickness="0">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="{DynamicResource Accent}" CornerRadius="2" Height="4"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.DecreaseRepeatButton>
                <Track.IncreaseRepeatButton>
                  <RepeatButton Command="{x:Static Slider.IncreaseLarge}" BorderThickness="0">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="{DynamicResource Border}" CornerRadius="2" Height="4"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.IncreaseRepeatButton>
                <Track.Thumb>
                  <Thumb Width="14" Height="14">
                    <Thumb.Template>
                      <ControlTemplate TargetType="Thumb"><Border Background="{DynamicResource Text}" CornerRadius="2" BorderBrush="{DynamicResource Accent}" BorderThickness="1"/></ControlTemplate>
                    </Thumb.Template>
                  </Thumb>
                </Track.Thumb>
              </Track>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="ScrollBar">
      <Setter Property="Background" Value="{DynamicResource Bg}"/>
      <Setter Property="Width" Value="10"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ScrollBar">
            <Grid Background="{TemplateBinding Background}">
              <Track x:Name="PART_Track" IsDirectionReversed="True">
                <Track.DecreaseRepeatButton>
                  <RepeatButton x:Name="decrease" Command="{x:Static ScrollBar.PageUpCommand}" Focusable="False">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="Transparent"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.DecreaseRepeatButton>
                <Track.Thumb>
                  <Thumb>
                    <Thumb.Template>
                      <ControlTemplate TargetType="Thumb"><Border Background="{DynamicResource Border}" CornerRadius="4" Margin="2"/></ControlTemplate>
                    </Thumb.Template>
                  </Thumb>
                </Track.Thumb>
                <Track.IncreaseRepeatButton>
                  <RepeatButton x:Name="increase" Command="{x:Static ScrollBar.PageDownCommand}" Focusable="False">
                    <RepeatButton.Template>
                      <ControlTemplate TargetType="RepeatButton"><Border Background="Transparent"/></ControlTemplate>
                    </RepeatButton.Template>
                  </RepeatButton>
                </Track.IncreaseRepeatButton>
              </Track>
            </Grid>
            <ControlTemplate.Triggers>
              <Trigger Property="Orientation" Value="Horizontal">
                <Setter TargetName="PART_Track" Property="Orientation" Value="Horizontal"/>
                <Setter TargetName="PART_Track" Property="IsDirectionReversed" Value="False"/>
                <Setter TargetName="decrease" Property="Command" Value="{x:Static ScrollBar.PageLeftCommand}"/>
                <Setter TargetName="increase" Property="Command" Value="{x:Static ScrollBar.PageRightCommand}"/>
                <Setter Property="Width" Value="Auto"/>
                <Setter Property="Height" Value="10"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
      <Style.Triggers>
        <Trigger Property="Orientation" Value="Vertical">
          <Setter Property="Height" Value="Auto"/>
        </Trigger>
      </Style.Triggers>
    </Style>
    <Style TargetType="TabItem">
      <Setter Property="Foreground" Value="{DynamicResource Muted}"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TabItem">
            <Border x:Name="t" BorderThickness="0,0,0,2" BorderBrush="Transparent" Padding="12,6" Margin="0,0,2,0">
              <ContentPresenter ContentSource="Header" TextElement.FontWeight="SemiBold"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsSelected" Value="True">
                <Setter TargetName="t" Property="BorderBrush" Value="{DynamicResource Accent}"/>
                <Setter Property="Foreground" Value="{DynamicResource Text}"/>
              </Trigger>
              <Trigger Property="IsMouseOver" Value="True"><Setter Property="Foreground" Value="{DynamicResource Text}"/></Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="TabControl">
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TabControl">
            <Grid>
              <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="*"/></Grid.RowDefinitions>
              <Border BorderBrush="{DynamicResource Border}" BorderThickness="0,0,0,1"><TabPanel IsItemsHost="True"/></Border>
              <ContentPresenter Grid.Row="1" ContentSource="SelectedContent"/>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Grid Margin="14">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <Border Grid.Row="0" BorderBrush="{DynamicResource Border}" BorderThickness="0,0,0,1" Padding="0,0,0,10">
      <StackPanel>
        <StackPanel Orientation="Horizontal">
          <TextBlock Text=">_" Foreground="{DynamicResource Accent}" FontFamily="Cascadia Mono, Consolas" FontWeight="Bold" FontSize="16" VerticalAlignment="Center"/>
          <TextBlock Text="OpenCode" Foreground="{DynamicResource Text}" FontWeight="SemiBold" FontSize="16" Margin="8,0,0,0" VerticalAlignment="Center"/>
          <TextBlock Text="customize" Foreground="{DynamicResource Muted}" FontSize="11" Margin="10,0,0,0" VerticalAlignment="Center"/>
        </StackPanel>
        <TextBlock Text="cli.json · temas" Foreground="{DynamicResource Muted}" FontSize="11" TextWrapping="Wrap" Margin="0,4,0,0"/>
        <Border x:Name="BusyBanner" Background="{DynamicResource BgHigh}" BorderBrush="{DynamicResource Accent}" BorderThickness="1" CornerRadius="2" Padding="8,3" Margin="0,6,0,0" HorizontalAlignment="Left" Visibility="Collapsed">
          <TextBlock x:Name="Busy" Foreground="{DynamicResource Accent}" FontSize="11"/>
        </Border>
      </StackPanel>
    </Border>

    <TabControl Grid.Row="1" x:Name="Tabs" Margin="0,12,0,0" Background="Transparent" BorderThickness="0">
      <TabItem Header="Tema">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel Margin="0,10,6,10">
            <StackPanel x:Name="ThemeConfigPanel"/>
            <Border x:Name="ThemeEditor" BorderBrush="{DynamicResource Accent}" BorderThickness="1" CornerRadius="2" Padding="12,10" Margin="0,10,0,0">
              <StackPanel>
                <TextBlock Text="> Editar tema" Foreground="{DynamicResource Accent}" FontWeight="SemiBold" FontSize="14"/>
                <TextBlock Text="Cria um tema em ~/.config/opencode/themes e ativa em theme.name. Temas embutidos não são alterados. Para trocar a base, selecione o tema e reabra esta janela. Temas novos podem precisar de fechar e reabrir o OpenCode." Foreground="{DynamicResource Muted}" TextWrapping="Wrap" Margin="0,4,0,10"/>

                <Grid Margin="0,0,0,6">
                  <Grid.ColumnDefinitions><ColumnDefinition Width="130"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                  <TextBlock Text="Tema em edição" Foreground="{DynamicResource Muted}" VerticalAlignment="Center"/>
                  <ComboBox x:Name="ThemeSelect" Grid.Column="1"/>
                </Grid>
                <Grid Margin="0,0,0,6">
                  <Grid.ColumnDefinitions><ColumnDefinition Width="130"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                  <TextBlock Text="Nome do arquivo" Foreground="{DynamicResource Muted}" VerticalAlignment="Center"/>
                  <TextBox x:Name="ThemeName" Grid.Column="1"/>
                </Grid>
                <Grid Margin="0,0,0,6">
                  <Grid.ColumnDefinitions><ColumnDefinition Width="130"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
                  <TextBlock Text="Modo" Foreground="{DynamicResource Muted}" VerticalAlignment="Center"/>
                  <ComboBox x:Name="ThemeMode" Grid.Column="1"/>
                </Grid>

                <StackPanel x:Name="ThemeColorsPanel" Margin="0,6,0,0"/>

                <Border x:Name="ThemePreview" CornerRadius="2" Padding="12,10" Margin="0,10,0,0" BorderThickness="1" BorderBrush="{DynamicResource Border}" Background="{DynamicResource Bg}">
                  <StackPanel x:Name="ThemePreviewPanel">
                    <TextBlock x:Name="PreviewTitle" Text=">_ OpenCode" FontWeight="SemiBold" FontSize="14"/>
                    <TextBlock x:Name="PreviewText" Text="> Olá! Como posso ajudar?" FontFamily="Cascadia Mono, Consolas" Margin="0,6,0,0"/>
                    <TextBlock x:Name="PreviewMuted" Text="  conectado · sessão nova" FontSize="11" FontFamily="Cascadia Mono, Consolas" Margin="0,2,0,0"/>
                    <TextBlock x:Name="PreviewCode" Text="  const x = a => a !== 0 // 0O 1lI" FontSize="11" FontFamily="Cascadia Mono, Consolas" Margin="0,2,0,0"/>
                    <Border x:Name="PreviewAdded" CornerRadius="2" Padding="6,2" Margin="0,6,0,0">
                      <TextBlock x:Name="PreviewAddedText" Text="+ const resposta = 42" FontFamily="Cascadia Mono, Consolas"/>
                    </Border>
                    <Border x:Name="PreviewRemoved" CornerRadius="2" Padding="6,2" Margin="0,2,0,0">
                      <TextBlock x:Name="PreviewRemovedText" Text="- const resposta = 41" FontFamily="Cascadia Mono, Consolas"/>
                    </Border>
                  </StackPanel>
                </Border>

                <CheckBox x:Name="AdvancedToggle" Content="Avançado (JSON do tema)" Foreground="{DynamicResource Text}" Margin="0,10,0,0"/>
                <Border x:Name="AdvancedPanel" Visibility="Collapsed" Margin="0,6,0,0">
                  <StackPanel>
                    <TextBlock Text="O JSON mostra o último estado aplicado. Edite e clique em Aplicar JSON; depois salve o tema. Aplicar JSON descarta as cores não salvas nos pickers." Foreground="{DynamicResource Muted}" FontSize="11" TextWrapping="Wrap" Margin="0,4,0,6"/>
                    <TextBox x:Name="ThemeJsonBox" Height="240" AcceptsReturn="True" AcceptsTab="True" FontFamily="Consolas" FontSize="11"
                             VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Auto" TextWrapping="NoWrap"/>
                    <StackPanel Orientation="Horizontal" Margin="0,6,0,0">
                      <Button x:Name="ThemeJsonLoadBtn" Content="Carregar do rascunho"/>
                      <Button x:Name="ThemeJsonApplyBtn" Content="Aplicar JSON" Margin="8,0,0,0"/>
                    </StackPanel>
                  </StackPanel>
                </Border>

                <StackPanel Orientation="Horizontal" Margin="0,10,0,0">
                  <Button x:Name="ThemeSaveBtn" Content="Salvar tema" Background="{DynamicResource Accent}" Foreground="{DynamicResource OnAccent}" FontWeight="SemiBold" Padding="12,5"/>
                  <Button x:Name="ThemeDeleteBtn" Content="Excluir tema" Margin="8,0,0,0"/>
                </StackPanel>
                <TextBlock x:Name="ThemeHint" Foreground="{DynamicResource Muted}" FontSize="11" TextWrapping="Wrap" Margin="0,6,0,0"/>
              </StackPanel>
            </Border>
          </StackPanel>
        </ScrollViewer>
      </TabItem>
      <TabItem Header="Aparência">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel x:Name="AppearancePanel" Margin="0,10,6,10"/>
        </ScrollViewer>
      </TabItem>
      <TabItem Header="Sessão">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel x:Name="SessionPanel" Margin="0,10,6,10"/>
        </ScrollViewer>
      </TabItem>
      <TabItem Header="Entrada">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel x:Name="InputPanel" Margin="0,10,6,10"/>
        </ScrollViewer>
      </TabItem>
      <TabItem Header="Mini">
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel x:Name="MiniPanel" Margin="0,10,6,10"/>
        </ScrollViewer>
      </TabItem>
    </TabControl>

    <Border Grid.Row="2" BorderBrush="{DynamicResource Border}" BorderThickness="0,1,0,0" Padding="0,10,0,0" Margin="0,8,0,0">
      <Grid>
        <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
        <StackPanel VerticalAlignment="Center">
          <TextBlock x:Name="Changed" Foreground="{DynamicResource Muted}"/>
          <TextBlock x:Name="Message" TextWrapping="Wrap"/>
        </StackPanel>
        <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
          <Button x:Name="OpenConfigBtn" Content="cli.json" ToolTip="Abrir o cli.json" Margin="0,0,6,0" Padding="8,3" FontSize="12"/>
          <Button x:Name="OpenThemesBtn" Content="temas" ToolTip="Abrir a pasta de temas" Margin="0,0,6,0" Padding="8,3" FontSize="12"/>
          <Button x:Name="RestoreBtn" Content="↺ Restaurar padrão" ToolTip="Volta tudo o que foi mudado por esta janela ao que era antes" Padding="6,3" FontSize="11"/>
        </StackPanel>
      </Grid>
    </Border>
  </Grid>
</Window>
"@

$Win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $Xaml))

$UI = @{}
foreach ($n in 'Tabs', 'ThemeConfigPanel', 'AppearancePanel', 'SessionPanel', 'InputPanel', 'MiniPanel',
    'ThemeEditor', 'ThemeSelect', 'ThemeName', 'ThemeMode', 'ThemeColorsPanel',
    'ThemePreview', 'ThemePreviewPanel', 'PreviewTitle', 'PreviewText', 'PreviewMuted', 'PreviewCode',
    'PreviewAdded', 'PreviewAddedText', 'PreviewRemoved', 'PreviewRemovedText',
    'ThemeJsonBox', 'ThemeJsonLoadBtn', 'ThemeJsonApplyBtn', 'ThemeSaveBtn', 'ThemeDeleteBtn', 'ThemeHint',
    'AdvancedToggle', 'AdvancedPanel',
    'BusyBanner', 'Busy',
    'Changed', 'Message', 'RestoreBtn', 'OpenConfigBtn', 'OpenThemesBtn') {
    $UI[$n] = $Win.FindName($n)
}

$script:State = $null
$script:Stamp = [datetime]::MinValue
$script:Updating = $false
$script:UiSignature = ''
$script:ConfigJson = ''
$script:SliderLabels = @{}
$script:ThemeSignature = ''
$script:ThemeDraft = $null
$script:Palette = @{ light = @(); dark = @() }
$script:EditMode = 'dark'
$script:EditModeChosen = $false
$script:JsonRevision = -1
$script:JsonDirty = $false
$script:ThemeNameStart = ''
$script:ThemeSelectIndex = 0
$script:ThemeInvalid = $false
$script:UpdatingTheme = $false
$script:Busy = $false
$script:BusyMessage = ''
$script:BusyDots = 1
$script:BusyStarted = [datetime]::MinValue
$script:BusyFrom = ''

$script:Panels = @{
    'Tema' = $UI.ThemeConfigPanel
    'Aparência' = $UI.AppearancePanel
    'Sessão' = $UI.SessionPanel
    'Entrada' = $UI.InputPanel
    'Mini' = $UI.MiniPanel
}
$script:TabOfGroup = @{
    'Tema' = 'Tema'
    'Aparência' = 'Aparência'
    'Terminal' = 'Aparência'
    'Alertas' = 'Aparência'
    'Sessão' = 'Sessão'
    'Abas' = 'Sessão'
    'Diffs' = 'Sessão'
    'Entrada' = 'Entrada'
    'Mini' = 'Mini'
}

# ---------- tema da janela ----------
function CanonicalHex([string]$value) {
    $text = ([string]$value).Trim().TrimStart('#')
    if ($text -notmatch '^[0-9A-Fa-f]+$') { return '' }
    if ($text.Length -eq 3 -or $text.Length -eq 4) {
        $text = -join ($text.ToCharArray() | ForEach-Object { "$_$_" })
    }
    if ($text.Length -ne 6 -and $text.Length -ne 8) { return '' }
    return '#' + $text.ToUpper()
}

function RgbHex([string]$value) {
    $canonical = CanonicalHex $value
    if (-not $canonical) { return '' }
    $text = $canonical.TrimStart('#')
    if ($text.Length -eq 8) { $text = $text.Substring(0, 6) }
    return '#' + $text
}

function HexColor([string]$value, [string]$fallback) {
    $rgb = RgbHex $value
    if ($rgb) { return $rgb }
    return $fallback
}

function BlendHex([string]$foreground, [string]$background, [double]$alpha) {
    try {
        $fg = [System.Drawing.ColorTranslator]::FromHtml($foreground)
        $bg = [System.Drawing.ColorTranslator]::FromHtml($background)
        $r = [int][Math]::Round($fg.R * $alpha + $bg.R * (1 - $alpha))
        $g = [int][Math]::Round($fg.G * $alpha + $bg.G * (1 - $alpha))
        $b = [int][Math]::Round($fg.B * $alpha + $bg.B * (1 - $alpha))
        return ('#{0:X2}{1:X2}{2:X2}' -f $r, $g, $b)
    } catch { return $background }
}

function ContrastHex([string]$value) {
    try {
        $c = [System.Drawing.ColorTranslator]::FromHtml($value)
        $lum = 0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B
        if ($lum -gt 130) { return '#0A0A0A' }
        return '#FFFFFF'
    } catch { return '#FFFFFF' }
}

function ThemeColorFrom([string]$mode, [string]$path, [string]$fallback) {
    if (-not $script:State) { return $fallback }
    $active = $script:State.activeTheme
    if ($active -and $active.palette) {
        $rows = @($active.palette)
    } elseif ($script:State.themeDraft -and $script:State.themeDraft.palette) {
        $rows = @($script:State.themeDraft.palette.$mode)
    } else {
        return $fallback
    }
    $row = $rows | Where-Object { $_ -and [string]$_.path -eq $path } | Select-Object -First 1
    $rgb = if ($row) { RgbHex ([string]$row.value) } else { '' }
    if ($rgb) { return $rgb }
    return $fallback
}

function SetUiBrush([string]$key, [string]$hex) {
    $brush = NewBrush $hex
    $Win.Resources.Remove($key)
    $Win.Resources.Add($key, $brush)
}

function SetWindowIcon([string]$background, [string]$accent) {
    try {
        $bmp = New-Object System.Drawing.Bitmap 64, 64
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($background))
        $font = New-Object System.Drawing.Font('Consolas', 26, [System.Drawing.FontStyle]::Bold)
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($accent))
        $graphics.DrawString('>_', $font, $brush, 3, 12)
        $graphics.Dispose(); $font.Dispose(); $brush.Dispose()
        $icon = Join-Path $env:TEMP 'opencode-customize-icon.png'
        $bmp.Save($icon, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        $Win.Icon = [System.Windows.Media.Imaging.BitmapFrame]::Create([Uri]$icon)
    } catch { }
}

function ApplyUiTheme {
    $mode = 'dark'
    if ($script:State) {
        $active = $script:State.activeTheme
        if ($active -and ([string]$active.mode -eq 'light' -or [string]$active.mode -eq 'dark')) {
            $mode = [string]$active.mode
        } else {
            $modeRow = @($script:State.config | Where-Object { $_ -and $_.key -eq 'theme.mode' }) | Select-Object -First 1
            if ($modeRow -and ([string]$modeRow.value -eq 'light' -or [string]$modeRow.value -eq 'dark')) {
                $mode = [string]$modeRow.value
            } elseif ([string]$script:State.snapshotMode -eq 'light' -or [string]$script:State.snapshotMode -eq 'dark') {
                $mode = [string]$script:State.snapshotMode
            }
        }
    }
    $fallback = if ($mode -eq 'light') {
        @{ Bg = '#FFFFFF'; BgRaised = '#FAFAFA'; BgHigh = '#F5F5F5'; Border = '#B8B8B8'; Text = '#1A1A1A'; Muted = '#8A8A8A'; Accent = '#D68C27'; AccentAlt = '#3B7DD8'; Ok = '#3D9A57'; Err = '#D1383D'; Warn = '#D68C27' }
    } else {
        @{ Bg = '#0A0A0A'; BgRaised = '#141414'; BgHigh = '#1E1E1E'; Border = '#484848'; Text = '#EEEEEE'; Muted = '#808080'; Accent = '#9D7CD8'; AccentAlt = '#FAB283'; Ok = '#7FD88F'; Err = '#E06C75'; Warn = '#F5A742' }
    }
    $bg = HexColor (ThemeColorFrom $mode 'background.base' $fallback.Bg) $fallback.Bg
    $bgRaised = HexColor (ThemeColorFrom $mode 'background.raised.base' $fallback.BgRaised) $fallback.BgRaised
    $bgHigh = HexColor (ThemeColorFrom $mode 'background.raised.high' $fallback.BgHigh) $fallback.BgHigh
    $border = HexColor (ThemeColorFrom $mode 'border.base' $fallback.Border) $fallback.Border
    $text = HexColor (ThemeColorFrom $mode 'text.base' $fallback.Text) $fallback.Text
    $muted = HexColor (ThemeColorFrom $mode 'text.muted' $fallback.Muted) $fallback.Muted
    $accent = HexColor (ThemeColorFrom $mode 'markdown.heading' $fallback.Accent) $fallback.Accent
    $accentAlt = HexColor (ThemeColorFrom $mode 'syntax.function' $fallback.AccentAlt) $fallback.AccentAlt
    $ok = HexColor (ThemeColorFrom $mode 'text.feedback.success.base' $fallback.Ok) $fallback.Ok
    $err = HexColor (ThemeColorFrom $mode 'text.feedback.error.base' $fallback.Err) $fallback.Err
    $warn = HexColor (ThemeColorFrom $mode 'text.feedback.warning.base' $fallback.Warn) $fallback.Warn
    $selection = BlendHex $accent $bg 0.18
    $onAccent = ContrastHex $accent
    $signature = @($mode, $bg, $bgRaised, $bgHigh, $border, $text, $muted, $accent, $accentAlt, $ok, $err, $warn) -join '|'
    if ($signature -eq $script:UiSignature) { return $false }
    $script:UiSignature = $signature
    $script:Brush = @{
        Text = NewBrush $text; Subtle = NewBrush $muted; Accent = NewBrush $accent; Border = NewBrush $border
        Card = NewBrush $bgRaised; Bg = NewBrush $bg; BgHigh = NewBrush $bgHigh; Ok = NewBrush $ok; Err = NewBrush $err
        Warn = NewBrush $warn; OnAccent = NewBrush $onAccent
    }
    SetUiBrush 'Bg' $bg
    SetUiBrush 'BgRaised' $bgRaised
    SetUiBrush 'BgHigh' $bgHigh
    SetUiBrush 'Border' $border
    SetUiBrush 'Text' $text
    SetUiBrush 'Muted' $muted
    SetUiBrush 'Accent' $accent
    SetUiBrush 'AccentAlt' $accentAlt
    SetUiBrush 'Ok' $ok
    SetUiBrush 'Err' $err
    SetUiBrush 'Warn' $warn
    SetUiBrush 'Selection' $selection
    SetUiBrush 'OnAccent' $onAccent
    SetWindowIcon $bg $accent
    $UI.ThemeHint.Foreground = $script:Brush.Subtle
    return $true
}

function StartBusy([string]$message) {
    $script:Busy = $true
    $script:BusyMessage = $message
    $script:BusyDots = 1
    $script:BusyStarted = Get-Date
    $script:BusyFrom = $script:UiSignature
    $UI.Busy.Text = '⟳ ' + $message + '.'
    $UI.BusyBanner.Visibility = 'Visible'
}

function StopBusy([switch]$TimedOut) {
    $script:Busy = $false
    $UI.Busy.Text = ''
    $UI.BusyBanner.Visibility = 'Collapsed'
    if ($TimedOut) {
        $UI.Message.Text = 'Ainda não mudou. Temas novos podem precisar de reabrir o OpenCode.'
        $UI.Message.Foreground = $Brush.Warn
    }
}

function ThemeHasChanges {
    if ($script:JsonDirty) { return $true }
    if ($UI.ThemeName -and ([string]$UI.ThemeName.Text).Trim() -ne [string]$script:ThemeNameStart) { return $true }
    foreach ($mode in 'light', 'dark') {
        foreach ($row in @($script:Palette[$mode])) {
            if ($null -eq $row) { continue }
            if ([string]$row.value -ne [string]$row.start) { return $true }
        }
    }
    return $false
}

function ConfirmDiscard([string]$action) {
    if (-not (ThemeHasChanges)) { return $true }
    $r = [System.Windows.MessageBox]::Show(
        $Win,
        "Há alterações não salvas no tema. Descartar e $action?",
        'Alterações não salvas',
        'YesNo',
        'Warning')
    return $r -eq 'Yes'
}

# ---------- peças de interface ----------
function Label([string]$s, $brush = $null, [switch]$Bold, $size = 0, $margin = '0') {
    $t = New-Object System.Windows.Controls.TextBlock
    $t.Text = $s; $t.VerticalAlignment = 'Center'; $t.Margin = $margin; $t.TextWrapping = 'Wrap'
    if ($brush) { $t.Foreground = $brush }
    if ($Bold) { $t.FontWeight = 'SemiBold' }
    if ($size) { $t.FontSize = $size }
    $t
}

function SendConfig([string]$key, $value) {
    if ($script:Updating) { return }
    if ($key -eq 'theme.name' -or $key -eq 'theme.mode') { StartBusy 'Aplicando tema' }
    Send @{ cmd = 'config'; key = $key; value = $value }
}

function Invariant([double]$value) {
    return $value.ToString([System.Globalization.CultureInfo]::InvariantCulture)
}

function ParseNumber([string]$text) {
    $n = 0.0
    $clean = $text.Trim().Replace(',', '.')
    if ([double]::TryParse($clean, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { return $n }
    return $null
}

function AddConfigRow($panel, $row) {
    $card = New-Object System.Windows.Controls.Border
    $card.CornerRadius = '8'; $card.Padding = '10,8'; $card.Margin = '0,0,0,6'; $card.BorderThickness = '1'
    $card.BorderBrush = if ($row.key -eq 'theme.name') { $Brush.Accent } else { $Brush.Border }
    $card.Background = $Brush.Card
    $g = New-Object System.Windows.Controls.Grid
    $a = New-Object System.Windows.Controls.ColumnDefinition; $a.Width = '*'
    $b = New-Object System.Windows.Controls.ColumnDefinition
    $b.Width = if ($row.kind -eq 'number' -and $row.ui -eq 'slider') { '240' } else { 'Auto' }
    $g.ColumnDefinitions.Add($a); $g.ColumnDefinitions.Add($b)
    $left = New-Object System.Windows.Controls.StackPanel
    [void]$left.Children.Add((Label $row.label $Brush.Text -Bold))
    if ($row.description) { [void]$left.Children.Add((Label $row.description $Brush.Subtle -size 11)) }
    [System.Windows.Controls.Grid]::SetColumn($left, 0); [void]$g.Children.Add($left)

    if ($row.kind -eq 'boolean') {
        $c = New-Object System.Windows.Controls.CheckBox
        $c.IsChecked = [bool]$row.value; $c.Tag = $row.key; $c.Margin = '10,0,0,0'
        $c.Add_Click({ param($src) SendConfig $src.Tag ([bool]$src.IsChecked) })
    } elseif ($row.kind -eq 'number' -and $row.ui -eq 'slider') {
        $wrap = New-Object System.Windows.Controls.Grid
        $sc = New-Object System.Windows.Controls.ColumnDefinition; $sc.Width = '*'
        $lc = New-Object System.Windows.Controls.ColumnDefinition; $lc.Width = '52'
        $wrap.ColumnDefinitions.Add($sc); $wrap.ColumnDefinitions.Add($lc)
        $s = New-Object System.Windows.Controls.Slider
        $s.Minimum = [double]$row.min; $s.Maximum = [double]$row.max
        $s.TickFrequency = [double]$row.step; $s.IsSnapToTickEnabled = $true
        $s.Value = [double]$row.value; $s.VerticalAlignment = 'Center'; $s.Tag = $row.key
        $v = Label '' $Brush.Text -margin '8,0,0,0'
        $script:SliderLabels[$row.key] = $v
        $s.Add_ValueChanged({
                param($src)
                $label = $script:SliderLabels[$src.Tag]
                if ($label) { $label.Text = [string]([Math]::Round($src.Value * 100)) + '%' }
            })
        $s.Add_LostMouseCapture({ param($src) SendConfig $src.Tag ([double]$src.Value) })
        $s.Add_LostKeyboardFocus({ param($src) SendConfig $src.Tag ([double]$src.Value) })
        [System.Windows.Controls.Grid]::SetColumn($s, 0); [void]$wrap.Children.Add($s)
        [System.Windows.Controls.Grid]::SetColumn($v, 1); [void]$wrap.Children.Add($v)
        $script:SliderLabels[$row.key].Text = [string]([Math]::Round([double]$row.value * 100)) + '%'
        $c = $wrap
    } elseif ($row.kind -eq 'text' -and $row.options) {
        $c = New-Object System.Windows.Controls.ComboBox
        $c.IsEditable = $false; $c.MinWidth = 180; $c.Margin = '10,0,0,0'; $c.VerticalAlignment = 'Center'; $c.Tag = $row.key
        foreach ($o in @($row.options)) { [void]$c.Items.Add([string]$o) }
        $c.SelectedItem = [string]$row.value
        $c.Add_SelectionChanged({
                param($src)
                if (-not $script:Updating -and $src.SelectedItem) { SendConfig $src.Tag ([string]$src.SelectedItem) }
            })
    } elseif ($row.kind -eq 'choice') {
        $c = New-Object System.Windows.Controls.ComboBox
        $c.MinWidth = 150; $c.Margin = '10,0,0,0'; $c.VerticalAlignment = 'Center'; $c.Tag = $row.key
        foreach ($o in @($row.options)) { [void]$c.Items.Add([string]$o) }
        $c.SelectedItem = [string]$row.value
        $c.Add_SelectionChanged({
                param($src)
                if (-not $script:Updating -and ($src.IsKeyboardFocusWithin -or $src.IsDropDownOpen -or $src.IsMouseOver)) {
                    SendConfig $src.Tag ([string]$src.SelectedItem)
                }
            })
    } elseif ($row.kind -eq 'number') {
        $c = New-Object System.Windows.Controls.TextBox
        $c.MinWidth = 140; $c.Margin = '10,0,0,0'; $c.VerticalAlignment = 'Center'; $c.Tag = $row.key
        $c.Text = Invariant ([double]$row.value)
        $c.Add_LostFocus({
                param($src)
                if ($script:Updating) { return }
                $n = ParseNumber ([string]$src.Text)
                if ($null -ne $n) { SendConfig $src.Tag $n } else { SendConfig $src.Tag ([string]$src.Text) }
            })
        $c.Add_KeyDown({
                param($src, $ev)
                if ($ev.Key -eq 'Return' -and -not $script:Updating) {
                    $n = ParseNumber ([string]$src.Text)
                    if ($null -ne $n) { SendConfig $src.Tag $n } else { SendConfig $src.Tag ([string]$src.Text) }
                }
            })
    } else {
        $c = New-Object System.Windows.Controls.TextBox
        $c.MinWidth = 150; $c.Margin = '10,0,0,0'; $c.VerticalAlignment = 'Center'; $c.Tag = $row.key
        $c.Text = [string]$row.value
        $c.Add_LostFocus({ param($src) if (-not $script:Updating) { SendConfig $src.Tag ([string]$src.Text) } })
        $c.Add_KeyDown({
                param($src, $ev)
                if ($ev.Key -eq 'Return' -and -not $script:Updating) { SendConfig $src.Tag ([string]$src.Text) }
            })
    }

    $c.IsEnabled = -not $row.isLocked
    [System.Windows.Controls.Grid]::SetColumn($c, 1); [void]$g.Children.Add($c)
    $card.Child = $g
    [void]$panel.Children.Add($card)
}

function FillConfig {
    $rows = @($script:State.config | Where-Object { $_ -ne $null })
    # A assinatura ignora os valores para não destruir o controle/foco a cada
    # alteração feita na própria janela. Mudanças externas aparecem ao reabrir.
    $sig = ($rows | Select-Object key, kind, options, group, label, description, min, max, step, integer, ui, isLocked |
        ConvertTo-Json -Compress -Depth 6)
    if ($sig -eq $script:ConfigJson) { return }
    $script:ConfigJson = $sig
    $script:Updating = $true
    $script:SliderLabels = @{}
    try {
        foreach ($p in @($UI.ThemeConfigPanel, $UI.AppearancePanel, $UI.SessionPanel, $UI.InputPanel, $UI.MiniPanel)) { $p.Children.Clear() }
        $lastGroup = @{}
        foreach ($row in $rows) {
            $tab = $script:TabOfGroup[[string]$row.group]
            if (-not $tab) { $tab = 'Aparência' }
            $panel = $script:Panels[$tab]
            if (-not $panel) { continue }
            if ($lastGroup[$tab] -ne $row.group) {
                $lastGroup[$tab] = [string]$row.group
                $header = Label ([string]$row.group) $Brush.Accent -Bold -size 12
                $header.Margin = '2,10,0,4'
                [void]$panel.Children.Add($header)
            }
            AddConfigRow $panel $row
        }
    } finally {
        $script:Updating = $false
    }
}

# ---------- editor de tema ----------
function ThemeColorOf([string]$path) {
    $row = @($script:Palette[$script:EditMode]) | Where-Object { $_.path -eq $path } | Select-Object -First 1
    $rgb = if ($row) { RgbHex ([string]$row.value) } else { '' }
    if ($rgb) { return $rgb }
    return '#000000'
}

function SafeBrush([string]$hex, [string]$fallback) {
    $rgb = RgbHex $hex
    if ($rgb) { return NewBrush $rgb }
    return NewBrush $fallback
}

function UpdateThemePreview {
    try {
        $UI.ThemePreview.Background = SafeBrush (ThemeColorOf 'background.base') '#0A0A0A'
        $UI.ThemePreview.BorderBrush = SafeBrush (ThemeColorOf 'border.base') '#3C3936'
        $UI.PreviewTitle.Foreground = SafeBrush (ThemeColorOf 'markdown.heading') '#D97757'
        $UI.PreviewText.Foreground = SafeBrush (ThemeColorOf 'text.base') '#ECE9E4'
        $UI.PreviewMuted.Foreground = SafeBrush (ThemeColorOf 'text.muted') '#9B968E'
        $UI.PreviewCode.Foreground = SafeBrush (ThemeColorOf 'syntax.function') '#8AB4F8'
        $UI.PreviewAdded.Background = SafeBrush (ThemeColorOf 'diff.background.added') '#20303B'
        $UI.PreviewAddedText.Foreground = SafeBrush (ThemeColorOf 'diff.text.added') '#4FD6BE'
        $UI.PreviewRemoved.Background = SafeBrush (ThemeColorOf 'diff.background.removed') '#37222C'
        $UI.PreviewRemovedText.Foreground = SafeBrush (ThemeColorOf 'diff.text.removed') '#C53B53'
    } catch { }
}

function PickThemeColor($tag) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $d = New-Object System.Windows.Forms.ColorDialog
        $d.FullOpen = $true
        $rgb = RgbHex ([string]$tag.row.value)
        if ($rgb) {
            $d.Color = [System.Drawing.ColorTranslator]::FromHtml($rgb)
        }
        $owner = New-Object System.Windows.Forms.NativeWindow
        $result = [System.Windows.Forms.DialogResult]::Cancel
        try {
            $owner.AssignHandle((New-Object System.Windows.Interop.WindowInteropHelper($Win)).Handle)
            $result = $d.ShowDialog($owner)
        } finally {
            $owner.ReleaseHandle()
        }
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
            $tag.text.Text = '#{0:X2}{1:X2}{2:X2}' -f $d.Color.R, $d.Color.G, $d.Color.B
        }
    } catch { }
}

function ThemeTextChanged($src) {
    if ($script:UpdatingTheme) { return }
    $info = $src.Tag
    $text = ([string]$src.Text).Trim()
    $canonical = CanonicalHex $text
    if ($canonical) {
        $info.row.value = $canonical
        if ($info.swatch) { $info.swatch.Background = SafeBrush $canonical '#141414' }
        $script:ThemeInvalid = $false
        $UI.ThemeHint.Text = 'Cor válida. Salve para aplicar.'
        $UI.ThemeHint.Foreground = $Brush.Subtle
        UpdateThemePreview
    } else {
        if ($info.swatch) { $info.swatch.Background = $Brush.Card }
        $script:ThemeInvalid = $true
        $UI.ThemeHint.Text = 'Cor inválida: use #RGB, #RGBA, #RRGGBB ou #RRGGBBAA.'
        $UI.ThemeHint.Foreground = $Brush.Err
    }
}

function BuildThemeColors {
    $UI.ThemeColorsPanel.Children.Clear()
    $script:ThemeInvalid = $false
    $lastGroup = ''
    foreach ($row in @($script:Palette[$script:EditMode])) {
        if ($row.group -ne $lastGroup) {
            $lastGroup = $row.group
            $header = Label $row.group $Brush.Accent -Bold -size 12
            $header.Margin = '2,8,0,2'
            [void]$UI.ThemeColorsPanel.Children.Add($header)
        }
        $grid = New-Object System.Windows.Controls.Grid
        $grid.Margin = '0,3,0,3'
        $c1 = New-Object System.Windows.Controls.ColumnDefinition; $c1.Width = '140'
        $c2 = New-Object System.Windows.Controls.ColumnDefinition; $c2.Width = 'Auto'
        $c3 = New-Object System.Windows.Controls.ColumnDefinition; $c3.Width = '34'
        $c4 = New-Object System.Windows.Controls.ColumnDefinition; $c4.Width = 'Auto'
        $grid.ColumnDefinitions.Add($c1); $grid.ColumnDefinitions.Add($c2)
        $grid.ColumnDefinitions.Add($c3); $grid.ColumnDefinitions.Add($c4)
        $l = Label $row.label $Brush.Subtle
        [System.Windows.Controls.Grid]::SetColumn($l, 0); [void]$grid.Children.Add($l)

        $tb = New-Object System.Windows.Controls.TextBox
        $tb.Width = 86; $tb.FontFamily = 'Consolas'; $tb.Text = [string]$row.value
        $swatch = New-Object System.Windows.Controls.Border
        $swatch.Width = 24; $swatch.Height = 20; $swatch.CornerRadius = '4'; $swatch.Margin = '6,0,6,0'
        $swatch.BorderThickness = '1'; $swatch.BorderBrush = $Brush.Border; $swatch.Cursor = 'Hand'
        $swatch.Background = SafeBrush ([string]$row.value) '#2A2826'
        $tb.Tag = @{ mode = $script:EditMode; path = $row.path; row = $row; swatch = $swatch }
        $swatch.Tag = @{ text = $tb; row = $row }
        $reset = New-Object System.Windows.Controls.Button
        $reset.Content = 'padrão'; $reset.Padding = '6,0'; $reset.FontSize = 11
        $reset.Tag = @{ text = $tb; row = $row }
        $reset.Add_Click({ param($src) $src.Tag.text.Text = [string]$src.Tag.row.default })
        $tb.Add_TextChanged({ param($src) ThemeTextChanged $src })
        $swatch.Add_MouseLeftButtonUp({ param($src) PickThemeColor $src.Tag })
        [System.Windows.Controls.Grid]::SetColumn($tb, 1); [void]$grid.Children.Add($tb)
        [System.Windows.Controls.Grid]::SetColumn($swatch, 2); [void]$grid.Children.Add($swatch)
        [System.Windows.Controls.Grid]::SetColumn($reset, 3); [void]$grid.Children.Add($reset)
        [void]$UI.ThemeColorsPanel.Children.Add($grid)
    }
}

function CopyThemeColors($rows) {
    $out = New-Object System.Collections.ArrayList
    foreach ($row in @($rows)) {
        if ($null -eq $row) { continue }
        [void]$out.Add([pscustomobject]@{
                path = [string]$row.path
                label = [string]$row.label
                group = [string]$row.group
                value = [string]$row.value
                default = [string]$row.default
                start = [string]$row.value
            })
    }
    return @($out)
}

function FillTheme {
    $draft = $script:State.themeDraft
    $json = $script:State.themeJson
    if (-not $draft) {
        $UI.ThemeEditor.IsEnabled = $false
        $UI.ThemeHint.Text = 'Nenhum tema em edição.'
        return
    }
    $UI.ThemeEditor.IsEnabled = $true
    $themes = @($script:State.themes | Where-Object { $_ -ne $null })
    $sig = ([string]$draft.name) + '|' + ([string]$draft.originalName) + '|' + ([string]$draft.source) + '|' + ($themes -join ',') + '|' + ($draft.palette | ConvertTo-Json -Compress -Depth 6)
    if ($sig -ne $script:ThemeSignature) {
        $script:ThemeSignature = $sig
        $script:ThemeDraft = $draft
        $script:Palette = @{
            light = @(CopyThemeColors $draft.palette.light)
            dark = @(CopyThemeColors $draft.palette.dark)
        }
        if (-not $script:EditModeChosen) {
            $activeMode = [string]$script:State.activeTheme.mode
            $snapshotMode = [string]$script:State.snapshotMode
            if ($activeMode -eq 'light' -or $activeMode -eq 'dark') {
                $script:EditMode = $activeMode
            } elseif ($snapshotMode -eq 'light' -or $snapshotMode -eq 'dark') {
                $script:EditMode = $snapshotMode
            } else {
                $modeRow = @($script:State.config) | Where-Object { $_.key -eq 'theme.mode' } | Select-Object -First 1
                if ($modeRow -and [string]$modeRow.value -eq 'light') { $script:EditMode = 'light' } else { $script:EditMode = 'dark' }
            }
            $script:EditModeChosen = $true
        }
        $script:UpdatingTheme = $true
        try {
            $UI.ThemeSelect.Items.Clear()
            [void]$UI.ThemeSelect.Items.Add('Novo tema (a partir do atual)')
            foreach ($t in $themes) { [void]$UI.ThemeSelect.Items.Add([string]$t) }
            $selectIndex = 0
            if ($draft.originalName) {
                for ($i = 0; $i -lt $themes.Count; $i++) {
                    if ([string]$themes[$i] -eq [string]$draft.originalName) { $selectIndex = $i + 1; break }
                }
            }
            $UI.ThemeSelect.SelectedIndex = $selectIndex
            $script:ThemeSelectIndex = $selectIndex
            $UI.ThemeName.Text = [string]$draft.name
            $script:ThemeNameStart = [string]$draft.name
            $UI.ThemeMode.Items.Clear()
            [void]$UI.ThemeMode.Items.Add('Escuro')
            [void]$UI.ThemeMode.Items.Add('Claro')
            $UI.ThemeMode.SelectedIndex = if ($script:EditMode -eq 'light') { 1 } else { 0 }
            $UI.ThemeDeleteBtn.IsEnabled = [bool]$draft.originalName
        } finally {
            $script:UpdatingTheme = $false
        }
        BuildThemeColors
        UpdateThemePreview
        if ($draft.source -eq 'new') {
            $UI.ThemeHint.Text = 'Novo tema. Salve para criar o arquivo e ativá-lo.'
        } else {
            $UI.ThemeHint.Text = 'Editando um tema customizado. Salvar sobrescreve o arquivo.'
        }
    }
    if ($json -and [int]$json.revision -ne $script:JsonRevision) {
        $script:JsonRevision = [int]$json.revision
        $script:UpdatingTheme = $true
        try {
            $UI.ThemeJsonBox.Text = [string]$json.text
        } finally {
            $script:UpdatingTheme = $false
        }
        $script:JsonDirty = $false
        if ($draft.source -eq 'new') {
            $UI.ThemeHint.Text = 'Novo tema. Salve para criar o arquivo e ativá-lo.'
        } else {
            $UI.ThemeHint.Text = 'Editando um tema customizado. Salvar sobrescreve o arquivo.'
        }
        $UI.ThemeHint.Foreground = $Brush.Subtle
    }
}

function ThemeColorsPayload {
    $list = New-Object System.Collections.ArrayList
    foreach ($mode in 'light', 'dark') {
        foreach ($row in @($script:Palette[$mode])) {
            if ($null -eq $row) { continue }
            if ([string]$row.value -eq [string]$row.start) { continue }
            [void]$list.Add(@{ mode = $mode; path = [string]$row.path; value = [string]$row.value })
        }
    }
    return @($list)
}

# ---------- estado ----------
function Load {
    $s = $script:State
    $uiChanged = ApplyUiTheme
    if ($uiChanged) { $script:ConfigJson = '' }
    $hasMessage = -not [string]::IsNullOrEmpty([string]$s.message)
    $hasError = [bool]$s.error
    if ($script:Busy -and ($hasMessage -or $hasError -or $script:UiSignature -ne $script:BusyFrom)) {
        StopBusy
    }
    $UI.Changed.Text = if ($s.changed) { "$($s.changed) ajuste(s) feitos por aqui" } else { 'Tudo no padrão' }
    $UI.Message.Text = [string]$s.message
    $ok = -not $hasMessage -or (
        [string]$s.message -match '^(Tema |Novo tema|JSON aplicado|JSON atualizado|Padrão restaurado|Nada para restaurar|Restaurar|Janela de customização|A janela de customização)' -and
        [string]$s.message -notmatch 'não mudou:|Falhas:'
    )
    $UI.Message.Foreground = if ($ok) { $Brush.Ok } else { $Brush.Err }
    if ($hasError) { $UI.Message.Text = $s.error; $UI.Message.Foreground = $Brush.Err }
    $UI.RestoreBtn.IsEnabled = [bool]$s.changed
    $UI.OpenConfigBtn.IsEnabled = [bool]$s.configPath
    $UI.OpenThemesBtn.IsEnabled = [bool]$s.themesDir
    FillConfig
    FillTheme
    if ($uiChanged -and $script:ThemeDraft) {
        BuildThemeColors
        UpdateThemePreview
    }
}

# ---------- eventos ----------
$UI.ThemeSelect.Add_SelectionChanged({
        if ($script:UpdatingTheme) { return }
        if (-not (ConfirmDiscard 'trocar de tema')) {
            $script:UpdatingTheme = $true
            try { $UI.ThemeSelect.SelectedIndex = $script:ThemeSelectIndex } finally { $script:UpdatingTheme = $false }
            return
        }
        if ($UI.ThemeSelect.SelectedIndex -le 0) {
            Send @{ cmd = 'theme-new' }
        } else {
            Send @{ cmd = 'theme-edit'; name = [string]$UI.ThemeSelect.SelectedItem }
        }
    })

$UI.ThemeMode.Add_SelectionChanged({
        if ($script:UpdatingTheme) { return }
        $script:EditMode = if ($UI.ThemeMode.SelectedIndex -eq 1) { 'light' } else { 'dark' }
        $script:EditModeChosen = $true
        BuildThemeColors
        UpdateThemePreview
    })

$UI.ThemeSaveBtn.Add_Click({
        if ($script:ThemeInvalid) {
            [void][System.Windows.MessageBox]::Show(
                $Win,
                'Há uma cor inválida no editor. Corrija os campos marcados antes de salvar.',
                'Cor inválida',
                'OK',
                'Warning')
            return
        }
        if ($script:JsonDirty) {
            $r = [System.Windows.MessageBox]::Show(
                $Win,
                'O JSON avançado foi alterado mas não foi aplicado. Salvar sem essas alterações?',
                'JSON não aplicado',
                'YesNo',
                'Warning')
            if ($r -ne 'Yes') { return }
        }
        StartBusy 'Salvando tema'
        Send @{ cmd = 'theme-save'; name = $UI.ThemeName.Text.Trim(); colors = @(ThemeColorsPayload) }
    })

$UI.ThemeDeleteBtn.Add_Click({
        $name = if ($script:ThemeDraft -and $script:ThemeDraft.originalName) { [string]$script:ThemeDraft.originalName } else { $UI.ThemeName.Text.Trim() }
        if (-not $name) { return }
        $r = [System.Windows.MessageBox]::Show($Win, "Excluir o tema $name? O arquivo será removido de ~/.config/opencode/themes.", 'Excluir tema', 'YesNo', 'Question')
        if ($r -eq 'Yes') {
            StartBusy 'Removendo tema'
            Send @{ cmd = 'theme-delete'; name = $name }
        }
    })

$UI.ThemeJsonLoadBtn.Add_Click({
        if (-not (ConfirmDiscard 'carregar o JSON do rascunho')) { return }
        Send @{ cmd = 'theme-json-get' }
    })

$UI.ThemeJsonApplyBtn.Add_Click({
        try {
            $obj = $UI.ThemeJsonBox.Text | ConvertFrom-Json
            if ($obj -is [System.Array]) { throw 'O tema precisa ser um objeto JSON.' }
            Send @{ cmd = 'theme-json'; json = $obj }
        } catch {
            $UI.ThemeHint.Text = "JSON inválido: $($_.Exception.Message)"
            $UI.ThemeHint.Foreground = $Brush.Err
        }
    })

$UI.ThemeJsonBox.Add_TextChanged({
        if ($script:UpdatingTheme) { return }
        $script:JsonDirty = $true
        $UI.ThemeHint.Text = 'JSON alterado. Clique em Aplicar JSON para usar as mudanças no rascunho.'
        $UI.ThemeHint.Foreground = $Brush.Subtle
    })

$UI.AdvancedToggle.Add_Click({
        $UI.AdvancedPanel.Visibility = if ($UI.AdvancedToggle.IsChecked) { 'Visible' } else { 'Collapsed' }
    })

$UI.RestoreBtn.Add_Click({
        $r = [System.Windows.MessageBox]::Show($Win, 'Voltar as opções do cli.json e os temas criados/alterados por esta janela ao que eram antes?', 'Restaurar padrão', 'YesNo', 'Question')
        if ($r -eq 'Yes') {
            StartBusy 'Restaurando'
            $script:ConfigJson = ''
            $script:ThemeSignature = ''
            $script:JsonRevision = -1
            Send @{ cmd = 'restore' }
        }
    })

$UI.OpenConfigBtn.Add_Click({
        try {
            if ($script:State.configPath) { Invoke-Item -LiteralPath $script:State.configPath }
        } catch {
            $UI.Message.Text = "Não consegui abrir o cli.json: $($_.Exception.Message)"
            $UI.Message.Foreground = $Brush.Err
        }
    })

$UI.OpenThemesBtn.Add_Click({
        try {
            if ($script:State.themesDir) {
                if (-not (Test-Path -LiteralPath $script:State.themesDir)) { New-Item -ItemType Directory -Force $script:State.themesDir | Out-Null }
                Start-Process explorer.exe -ArgumentList ('"{0}"' -f $script:State.themesDir)
            }
        } catch {
            $UI.Message.Text = "Não consegui abrir a pasta de temas: $($_.Exception.Message)"
            $UI.Message.Foreground = $Brush.Err
        }
    })

$Timer = New-Object System.Windows.Threading.DispatcherTimer
$Timer.Interval = [TimeSpan]::FromMilliseconds(300)
$Timer.Add_Tick({
        if ($script:Busy) {
            $elapsed = ((Get-Date) - $script:BusyStarted).TotalSeconds
            if ($elapsed -gt 3) {
                StopBusy -TimedOut
            } else {
                $script:BusyDots = ($script:BusyDots % 3) + 1
                $UI.Busy.Text = '⟳ ' + $script:BusyMessage + ('.' * $script:BusyDots)
            }
        }
        try {
            if (-not (Test-Path -LiteralPath $StateFile)) { return }
            $t = (Get-Item -LiteralPath $StateFile).LastWriteTimeUtc
            if ($t -eq $script:Stamp) { return }
            $script:State = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $script:Stamp = $t
            Load
        } catch { }
    })

$Win.Add_ContentRendered({
        $Win.Activate() | Out-Null
        $Win.Focus() | Out-Null
    })

$Win.Add_Closing({
        param($sender, $eventArgs)
        if (-not (ConfirmDiscard 'fechar a janela')) { $eventArgs.Cancel = $true }
    })

if ($Check) {
    $script:State = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:Stamp = (Get-Item -LiteralPath $StateFile).LastWriteTimeUtc
    Load
    if ($env:CUSTOMIZE_TAB) { $UI.Tabs.SelectedIndex = [int]$env:CUSTOMIZE_TAB }
    if ($env:CUSTOMIZE_JSON) {
        $UI.AdvancedToggle.IsChecked = $true
        $UI.AdvancedPanel.Visibility = 'Visible'
    }
    if ($env:CUSTOMIZE_BUSY) { StartBusy 'Aplicando tema' }
    $themeName = if ($script:State.themeDraft) { [string]$script:State.themeDraft.name } else { '(nenhum)' }
    Write-Host "ok: $($script:State.config.Count) opções, tema '$themeName'"
    if ($env:CUSTOMIZE_SHOT) {
        $root = $Win.Content; $Win.Content = $null
        $frame = New-Object System.Windows.Controls.Border
        $frame.Background = $Win.Background; $frame.Resources = $Win.Resources; $frame.Child = $root
        $frame.SetValue([System.Windows.Documents.TextElement]::ForegroundProperty, $Brush.Text)
        $frame.SetValue([System.Windows.Documents.TextElement]::FontFamilyProperty, $Win.FontFamily)
        $frame.Measure([System.Windows.Size]::new(680, 1900)); $frame.Arrange([System.Windows.Rect]::new(0, 0, 680, 1900)); $frame.UpdateLayout()
        $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap 680, 1900, 96, 96, ([System.Windows.Media.PixelFormats]::Pbgra32)
        $bmp.Render($frame)
        $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
        $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
        $fs = [IO.File]::Create($env:CUSTOMIZE_SHOT); $enc.Save($fs); $fs.Close()
    }
    exit 0
}

try {
    $script:State = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:Stamp = (Get-Item -LiteralPath $StateFile).LastWriteTimeUtc
    Load
} catch {
    ApplyUiTheme
}
$Timer.Start()
[void]$Win.ShowDialog()


